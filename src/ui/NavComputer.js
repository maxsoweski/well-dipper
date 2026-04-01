import { generateSystemName } from '../generation/NameGenerator.js';
import { StarSystemGenerator } from '../generation/StarSystemGenerator.js';
import { HashGridStarfield } from '../generation/HashGridStarfield.js';
import { GalacticSectors } from '../generation/GalacticSectors.js';
import { GalaxyLuminosityRenderer } from '../rendering/GalaxyLuminosityRenderer.js';
import { NavGalaxyRenderer } from '../rendering/NavGalaxyRenderer.js';
import alea from 'alea';

/**
 * NavComputer — 5-level interactive galaxy navigation.
 *
 * Level 1 (GALAXY):    Full spiral with named sector overlay. Click sector to zoom.
 * Level 2 (SECTOR):    Named sector, subdivided into density-adaptive districts.
 * Level 3 (DISTRICT):  District, subdivided into density-adaptive blocks.
 * Level 4 (BLOCK):     Block, subdivided into density-adaptive neighborhoods.
 * Level 5 (LOCAL):     3D star map (~100 stars). Default view on open.
 *
 * Level tabs at bottom for quick switching. Opens to LOCAL by default.
 * Panning supported at all 2D levels. Player position always visible.
 */

const LEVELS = ['galaxy', 'sector', 'region', 'column', 'system'];
const LEVEL_NAMES = ['GALAXY', 'SECTOR', 'REGION', 'COLUMN', 'SYSTEM'];
const GRID_N = 8; // tiles per axis (sector uses 8, region uses 16)

function gridNForLevel(levelIndex) {
  return levelIndex === 2 ? 16 : 8; // region = 16x16, sector = 8x8
}

export class NavComputer {
  constructor(canvas, galacticMap, webglRenderer) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._gm = galacticMap;

    // Sectors (persistent, named)
    this._sectors = new GalacticSectors(galacticMap, 'well-dipper-galaxy-1');

    // Current level
    this._levelIndex = 3; // start at COLUMN

    // ── 2D view state (shared by levels 0-3) ──
    this._viewCenter = { x: 8, z: 0 }; // center of current 2D view (kpc)
    this._viewSize = 44;               // full width of current view (kpc)
    this._hoveredTile = null;          // { col, row }

    // ── Level navigation stack ──
    // When drilling down, we push the parent view so we can go back
    this._viewStack = [];

    // ── Local level (3D) ──
    this._localCenter = { x: 8, y: 0, z: 0 };
    this._localRadius = 0.005; // kpc = 5 pc
    this._localStars = [];
    this._localRotX = 0.5;   // ~30° above the plane — good starting view
    this._localRotY = 0.3;
    this._hoveredLocalStar = null;

    // ── On-demand column loading ──
    // Only loads stars within the visible Y range. Expands as user scrolls.
    this._loadedYMin = null; // lowest Y (kpc) we've queried
    this._loadedYMax = null; // highest Y (kpc) we've queried
    this._loadedSeen = new Set(); // dedup keys for stars already in _localStars
    this._loadBlockCenter = null; // block center for current column
    this._loadBlockHalf = null;   // block half-size for current column
    this._bgLoadTimer = null;     // background expansion timer
    this._estimatedBlockStars = null; // estimated total stars in full column

    // ── Player ──
    this._playerX = 8;
    this._playerY = 0;
    this._playerZ = 0;
    this._currentSystemName = '';
    this._currentSector = null;

    // ── Warp target bridge ──
    this._selectedNavStar = null;   // star selected BY user in column view { wx, wy, wz, seed, name }
    this._externalTarget = null;    // warp target SET from outside { x, y, z } in galactic kpc

    // ── System view (level 4) ──
    this._systemStar = null;        // star data from column view click
    this._systemData = null;        // StarSystemGenerator.generate() result
    this._hoveredBody = null;       // planet/star under cursor { type, index }
    this._systemRotX = 0.5;         // 3D view rotation (elevation)
    this._systemRotY = 0.0;         // 3D view rotation (azimuth)
    this._systemMode = 'system';    // 'system' or 'planet'
    this._selectedPlanetIdx = -1;   // which planet is selected for detail view
    this._systemZoom = 1.0;         // zoom multiplier for system view

    // ── COMMIT BURN / WARP ──
    this._selectedBody = null;       // { type: 'star'|'planet'|'moon', index }
    this._commitAction = null;       // { type: 'burn'|'warp', target, planetIndex, moonIndex, star }
    this._commitButtonRect = null;   // { x, y, w, h } for click hit testing
    this._onCommit = null;           // callback: (action) => void
    this._pendingAction = null;      // set by COMMIT click, read by main.js closeNavComputer()
    this._onDrillSound = null;       // callback: (levelIndex) => void — plays level-appropriate sound
    this._onSound = null;            // callback: (soundName) => void — plays named SFX
    this._currentSystemData = null;  // actual spawned system data from main.js
    this._autopilotActive = false;   // mirror of autoNav state from main.js
    this._autopilotButtonRect = null;
    this._onAutopilotToggle = null;  // callback: (enable) => void

    // ── Ship position in current system ──
    // focusIndex: -1 = overview (no specific body), -2 = star, 0+ = planet index
    // focusMoonIndex: -1 = planet itself, 0+ = moon index
    this._currentFocusIndex = -1;
    this._currentMoonIndex = -1;

    // ── Drill-down animation ──
    this._anim = null; // { startTime, duration, fromCenter, fromSize, toCenter, toSize, fromLevel, toLevel }

    // ── Mouse ──
    this._mouseX = 0;
    this._mouseY = 0;
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartRotX = 0;
    this._dragStartRotY = 0;
    this._panStartCenter = null;

    // ── Galaxy renderer (GPU-accelerated top-down view) ──
    this._navGalaxyRenderer = webglRenderer ? new NavGalaxyRenderer(webglRenderer, galacticMap) : null;
    // Fallback: CPU luminosity renderer (used if no WebGL renderer available)
    this._luminosityRenderer = new GalaxyLuminosityRenderer(galacticMap);
    this._mapCache = new Map();  // key: "cx,cz,ext" → { canvas, lastUsed }
    this._mapCacheMax = 8;
    this._mapRes = 512;

    // ── Real star catalog (set via setRealStarCatalog) ──
    this._realStarCatalog = null;

    // ── RNG ──
    this._makeRng = (seed) => {
      const fn = alea(seed);
      return {
        float: () => fn(),
        int: (minOrMax, max) => {
          if (max === undefined) return Math.floor(fn() * minOrMax); // int(max) → [0, max)
          return minOrMax + Math.floor(fn() * (max - minOrMax + 1)); // int(min, max) → [min, max] inclusive
        },
        pick: (arr) => arr[Math.floor(fn() * arr.length)],
        bool: (p) => fn() < (p || 0.5), chance: (p) => fn() < p,
        child: (label) => this._makeRng(seed + ':' + label),
      };
    };

    // ── Events ──
    canvas.addEventListener('mousemove', this._handleMouseMove.bind(this));
    canvas.addEventListener('mousedown', this._handleMouseDown.bind(this));
    canvas.addEventListener('mouseup', this._handleMouseUp.bind(this));
    canvas.addEventListener('mouseleave', this._handleMouseUp.bind(this));
    canvas.addEventListener('click', this._handleClick.bind(this));
    canvas.addEventListener('wheel', this._handleWheel.bind(this), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // WASD panning for local view
    this._heldKeys = new Set();
    this._localDebug = false;
    this._localYOffset = 0; // Y offset for viewing above/below the plane
    this._onKeyDown = (e) => {
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'KeyF'].includes(e.code)) {
        this._heldKeys.add(e.code);
        e.preventDefault();
        e.stopPropagation();
      }
      if (e.code === 'Backquote' && this._levelIndex === 3) {
        this._localDebug = !this._localDebug;
        e.preventDefault();
        e.stopPropagation();
      }
    };
    this._onKeyUp = (e) => {
      this._heldKeys.delete(e.code);
    };
  }

  // ════════════════════════════════════════════════════
  // PUBLIC
  // ════════════════════════════════════════════════════

  activate() {
    document.addEventListener('keydown', this._onKeyDown, true);
    document.addEventListener('keyup', this._onKeyUp, true);
    this._resizeCanvas();
  }

  /** Open directly to the system view for the current system. */
  /** Open directly to the system view.
   *  @param {object} [starData] — star entry with wx/wy/wz/seed/name/spectral (bypasses async _localStars search)
   *  @param {object} [systemData] — actual spawned system data (guarantees moon index alignment) */
  openToCurrentSystem(starData, systemData) {
    const star = starData || this._findNearestStar();
    if (!star) return;
    if (!star.color) star.color = NavComputer._SPECTRAL_COLORS[star.spectral] || '#ffefb0';
    this._systemStar = star;
    this._selectedNavStar = star;
    this._externalTarget = { x: star.wx, y: star.wy, z: star.wz, name: star.name || '' };
    this._systemData = systemData || this._currentSystemData || null;
    if (systemData) this._currentSystemData = systemData;
    this._hoveredBody = null;
    this._systemMode = 'system';
    this._systemZoom = 1.0;
    this._clearCommitSelection();
    this._levelIndex = 4;
  }

  _resizeCanvas() {
    const rect = this._canvas.getBoundingClientRect();
    if (this._canvas.width !== rect.width || this._canvas.height !== rect.height) {
      this._canvas.width = rect.width;
      this._canvas.height = rect.height;
    }
  }

  deactivate() {
    document.removeEventListener('keydown', this._onKeyDown, true);
    document.removeEventListener('keyup', this._onKeyUp, true);
    this._heldKeys.clear();
    this._resetColumnLoad();
  }

  /**
   * Called by main.js when opening the nav computer with an existing warp target.
   * Stores the target's galactic position so all zoom levels can draw an indicator.
   * @param {{ x: number, y: number, z: number }} worldPos — galactic coords in kpc
   * @param {string} [name] — display name of the target
   */
  setRealStarCatalog(catalog) {
    this._realStarCatalog = catalog;
  }

  setExternalTarget(worldPos, name) {
    if (!worldPos) {
      this._externalTarget = null;
      return;
    }
    this._externalTarget = { x: worldPos.x, y: worldPos.y || 0, z: worldPos.z, name: name || '' };
    // If a local star matches this position, auto-select it
    this._tryAutoSelectExternalTarget();
  }

  /**
   * Returns the star selected inside the nav computer's local view.
   * main.js uses this to set a warp target when the nav computer closes.
   * @returns {{ worldX: number, worldY: number, worldZ: number, seed: number, name: string }|null}
   */
  getSelectedStar() {
    if (!this._selectedNavStar) return null;
    return {
      worldX: this._selectedNavStar.wx,
      worldY: this._selectedNavStar.wy,
      worldZ: this._selectedNavStar.wz,
      seed: this._selectedNavStar.seed,
      name: this._selectedNavStar.name,
      type: this._selectedNavStar.spectral,
    };
  }

  /** Set the actual spawned system data for the current system. */
  setCurrentSystemData(data) {
    this._currentSystemData = data;
  }

  /** Find the star nearest to the player's position in _localStars. */
  _findNearestStar() {
    if (!this._localStars || this._localStars.length === 0) return null;
    let best = null, bestDist = Infinity;
    for (const s of this._localStars) {
      const dx = s.wx - this._playerX;
      const dy = s.wy - this._playerY;
      const dz = s.wz - this._playerZ;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestDist) { bestDist = d; best = s; }
    }
    return best;
  }

  /** Check if the currently viewed system is the player's current system. */
  _isCurrentSystem() {
    if (!this._systemStar) return false;
    const dx = this._systemStar.wx - this._playerX;
    const dy = this._systemStar.wy - this._playerY;
    const dz = this._systemStar.wz - this._playerZ;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.002;
  }

  /** Set callback for COMMIT BURN/WARP button. */
  setCommitCallback(fn) { this._onCommit = fn; }

  /** Set callback for drill level sound. */
  setDrillSoundCallback(fn) { this._onDrillSound = fn; }

  /** Set callback for general UI sounds. */
  setSoundCallback(fn) { this._onSound = fn; }

  /** Set autopilot state (for display). */
  setAutopilotState(active) { this._autopilotActive = active; }

  /** Set callback for autopilot toggle. */
  setOnAutopilotToggle(fn) { this._onAutopilotToggle = fn; }

  /** Get the pending commit action (backup for close path). */
  getCommitAction() { return this._commitAction; }

  /** Build a commit action from the current selection. */
  _buildCommitAction() {
    if (!this._selectedBody || !this._systemStar) return null;
    const isCurrent = this._isCurrentSystem();
    const action = {
      type: isCurrent ? 'burn' : 'warp',
      target: this._selectedBody.type,
      starIndex: this._selectedBody.starIndex ?? 0,
      planetIndex: this._selectedBody.planetIndex ?? null,
      moonIndex: this._selectedBody.moonIndex ?? null,
      star: {
        wx: this._systemStar.wx, wy: this._systemStar.wy, wz: this._systemStar.wz,
        seed: this._systemStar.seed, name: this._systemStar.name, spectral: this._systemStar.spectral,
      },
    };
    return action;
  }

  /** Clear commit selection state. */
  _clearCommitSelection() {
    this._selectedBody = null;
    this._commitAction = null;
    this._commitButtonRect = null;
  }

  /**
   * If local stars are loaded and an external target is set,
   * find the matching star and auto-select it.
   */
  _tryAutoSelectExternalTarget() {
    if (!this._externalTarget || this._localStars.length === 0) return;
    const tx = this._externalTarget.x;
    const ty = this._externalTarget.y;
    const tz = this._externalTarget.z;
    let bestStar = null;
    let bestDist = Infinity;
    for (const s of this._localStars) {
      const dx = s.wx - tx, dy = s.wy - ty, dz = s.wz - tz;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestDist) { bestDist = d; bestStar = s; }
    }
    // Match within 1 pc (0.001 kpc)
    if (bestStar && bestDist < 0.001 * 0.001) {
      this._selectedNavStar = bestStar;
    }
  }

  /** Tell the nav computer which body the player is currently near.
   *  focusIndex: -1 = overview, -2 = star, 0+ = planet index
   *  moonIndex: -1 = planet itself, 0+ = specific moon */
  setCurrentBody(focusIndex, moonIndex) {
    this._currentFocusIndex = focusIndex;
    this._currentMoonIndex = moonIndex;
  }

  setPlayerPosition(galacticPos) {
    this._playerX = galacticPos.x;
    this._playerY = galacticPos.y || 0;
    this._playerZ = galacticPos.z;
    console.log(`[NAV] setPlayerPosition: Y=${galacticPos.y?.toFixed(4) || '0'} → _playerY=${this._playerY.toFixed(4)}`);
    this._currentSector = this._sectors.getSectorAt({ x: this._playerX, z: this._playerZ });

    // Center local view on player's actual 3D position (including height above plane)
    this._localCenter = { x: this._playerX, y: this._playerY, z: this._playerZ };
    // Cube size based on local density
    this._localCubeSize = Math.max(0.003, this._computeTileSize(this._playerX, this._playerZ, 150));
    this._localRadius = 0.0015; // ~5 light years default zoom
    // Fixed grid cell size — 1 pc (0.001 kpc), like tiles on a floor
    this._localGridCell = 0.001;
    this._localStars = [];
    this._resetColumnLoad();
    this._selectedNavStar = null; // clear any previous selection

    // Set up the view stack so all levels are centered on player
    this._setupViewStackForPlayer();
  }

  _setupViewStackForPlayer() {
    const ext = 22;
    this._viewStack = [
      { center: { x: 0, z: 0 }, size: ext * 2 }, // galaxy
    ];

    // Sector level — center on player's sector
    if (this._currentSector) {
      this._viewStack.push({
        center: { x: this._currentSector.centerX, z: this._currentSector.centerZ },
        size: this._currentSector.size,
        sectorName: this._currentSector.name,
      });
    } else {
      this._viewStack.push({ center: { x: this._playerX, z: this._playerZ }, size: 2 });
    }

    // Region — single 16x16 grid (merged district+block)
    const regionSize = this._computeTileSize(this._playerX, this._playerZ, 10000) * 16;
    this._viewStack.push({
      center: { x: this._playerX, z: this._playerZ },
      size: regionSize,
    });

    // Set current view based on level
    this._applyLevelView();
  }

  _applyLevelView() {
    const idx = this._levelIndex;
    if (idx < this._viewStack.length) {
      this._viewCenter = { ...this._viewStack[idx].center };
      this._viewSize = this._viewStack[idx].size;
    }
  }

  /**
   * Start an animated transition between two 2D views.
   * The animation smoothly interpolates center and size using ease-in-out.
   * @param {{ x: number, z: number }} fromCenter
   * @param {number} fromSize
   * @param {{ x: number, z: number }} toCenter
   * @param {number} toSize
   * @param {number} toLevel — level index to switch to when animation completes
   * @param {number} [duration=400] — animation duration in ms
   */
  _startDrillAnim(fromCenter, fromSize, toCenter, toSize, toLevel, duration = 400) {
    this._anim = {
      startTime: performance.now(),
      duration,
      fromCenter: { ...fromCenter },
      fromSize,
      toCenter: { ...toCenter },
      toSize,
      toLevel,
    };
  }

  /**
   * Update drill-down animation state. Called at start of render().
   * Returns true if animation is active (suppresses click handling).
   */
  _updateAnim() {
    if (!this._anim) return false;
    const elapsed = performance.now() - this._anim.startTime;
    let t = Math.min(1.0, elapsed / this._anim.duration);

    // Ease-in-out (smootherstep for polished feel)
    t = t * t * t * (t * (t * 6 - 15) + 10);

    // Interpolate view
    this._viewCenter.x = this._anim.fromCenter.x + (this._anim.toCenter.x - this._anim.fromCenter.x) * t;
    this._viewCenter.z = this._anim.fromCenter.z + (this._anim.toCenter.z - this._anim.fromCenter.z) * t;
    this._viewSize = this._anim.fromSize + (this._anim.toSize - this._anim.fromSize) * t;

    if (elapsed >= this._anim.duration) {
      // Animation complete — snap to final state and switch level
      this._levelIndex = this._anim.toLevel;
      this._applyLevelView();
      this._densityCacheKey = '';
      this._anim = null;
    }
    return true;
  }

  render() {
    this._resizeCanvas();
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    // System zoom animation (column → system transition)
    if (this._systemZoomAnim) {
      const za = this._systemZoomAnim;
      const elapsed = performance.now() - za.startTime;
      let t = Math.min(1.0, elapsed / za.duration);
      t = t * t; // ease-in (accelerate into the star)
      this._localRadius = za.fromRadius + (za.toRadius - za.fromRadius) * t;
      // Pan toward the star
      this._localCenter.x = za.fromCenter.x + (za.starPos.x - za.fromCenter.x) * t;
      this._localCenter.y = za.fromCenter.y + (za.starPos.y - za.fromCenter.y) * t;
      this._localCenter.z = za.fromCenter.z + (za.starPos.z - za.fromCenter.z) * t;
      if (t >= 1.0) {
        this._systemZoomAnim = null;
        this._levelIndex = 4; // switch to system view
      }
    }

    // Tilt animation (region → column transition)
    if (this._tiltAnim && this._levelIndex === 3) {
      if (!this._tiltAnim.startTime) this._tiltAnim.startTime = performance.now();
      const elapsed = performance.now() - this._tiltAnim.startTime;
      let t = Math.min(1.0, elapsed / this._tiltAnim.duration);
      t = t * t * (3 - 2 * t); // smoothstep
      this._localRotX = this._tiltAnim.from + (this._tiltAnim.to - this._tiltAnim.from) * t;
      if (t >= 1.0) this._tiltAnim = null;
    }

    // WASD panning in column view
    if (this._levelIndex === 3 && this._heldKeys.size > 0) {
      const panSpeed = this._localRadius * 0.01; // slow enough to see individual grid lines move
      const cosY = Math.cos(this._localRotY);
      const sinY = Math.sin(this._localRotY);

      // WASD moves relative to camera direction
      // W = forward (where camera faces), S = back, A = left, D = right
      const camAngle = this._localRotY;
      const fwdX = -Math.sin(camAngle);
      const fwdZ = -Math.cos(camAngle);
      const rightX = -fwdZ;
      const rightZ = fwdX;

      let dx = 0, dz = 0;
      if (this._heldKeys.has('KeyW')) { dx += fwdX * panSpeed; dz += fwdZ * panSpeed; }
      if (this._heldKeys.has('KeyS')) { dx -= fwdX * panSpeed; dz -= fwdZ * panSpeed; }
      if (this._heldKeys.has('KeyA')) { dx -= rightX * panSpeed; dz -= rightZ * panSpeed; }
      if (this._heldKeys.has('KeyD')) { dx += rightX * panSpeed; dz += rightZ * panSpeed; }

      // R/F moves the view up/down along Y axis
      if (this._heldKeys.has('KeyR')) { this._localCenter.y += panSpeed; }
      if (this._heldKeys.has('KeyF')) { this._localCenter.y -= panSpeed; }

      // Full column is queried once (all slices) — no re-query needed on Y scroll

      if (dx !== 0 || dz !== 0) {
        this._localCenter.x += dx;
        this._localCenter.z += dz;

        // Clamp to block boundaries (XZ only — Y is unconstrained)
        const blockCenter = this._viewStack[2]?.center;
        if (blockCenter && this._localCubeSize) {
          const half = this._localCubeSize;
          this._localCenter.x = Math.max(blockCenter.x - half, Math.min(blockCenter.x + half, this._localCenter.x));
          this._localCenter.z = Math.max(blockCenter.z - half, Math.min(blockCenter.z + half, this._localCenter.z));
        }
        // Don't re-query stars — we have the full block cached
      }
    }

    // Update drill-down animation (interpolates view center + size)
    this._updateAnim();

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, w, h);

    const level = LEVELS[this._levelIndex];
    if (level === 'system') {
      this._renderSystem(ctx, w, h);
    } else if (level === 'column') {
      this._renderLocal(ctx, w, h);
    } else {
      this._render2DLevel(ctx, w, h);
    }

    this._renderLevelTabs(ctx, w, h);
    this._renderHUD(ctx, w, h);
  }

  dispose() {
    // Events are GC'd with the canvas
  }

  handleEscape() {
    if (this._anim) return true; // ignore during animation
    if (this._levelIndex > 0) {
      // System view: planet detail → system overview → column
      if (this._levelIndex === 4) {
        this._clearCommitSelection();
        if (this._systemMode === 'planet') {
          this._systemMode = 'system';
          this._selectedPlanetIdx = -1;
          return true;
        }
        this._levelIndex = 3;
        // Stash binary status on the column star so column view can show a double-dot
        if (this._systemData?.isBinary && this._systemStar) {
          const match = this._localStars.find(s => s.seed === this._systemStar.seed);
          if (match) {
            match._isBinary = true;
            match._star2Type = this._systemData.star2?.type || null;
          }
        }
        this._systemStar = null;
        this._systemData = null;
        this._hoveredBody = null;
        this._systemMode = 'system';
        if (this._onDrillSound) this._onDrillSound(3);
        return true;
      }
      const prevLevel = this._levelIndex - 1;
      const target = this._viewStack[prevLevel];
      if (target && this._levelIndex <= 2) {
        // Animate zoom-out from current 2D view to parent level
        this._startDrillAnim(
          { x: this._viewCenter.x, z: this._viewCenter.z }, this._viewSize,
          { x: target.center.x, z: target.center.z }, target.size,
          prevLevel, 400
        );
      } else {
        // Instant switch (e.g., column→region, or missing stack entry)
        if (this._onDrillSound) this._onDrillSound(prevLevel);
        this._levelIndex = prevLevel;
        this._applyLevelView();
        this._densityCacheKey = '';
      }
      this._hoveredTile = null;
      this._localStars = [];
      this._resetColumnLoad();
      return true;
    }
    return false;
  }

  // ════════════════════════════════════════════════════
  // TILE IMAGE CACHE
  // ════════════════════════════════════════════════════

  /**
   * Get or render a cached tile image for a 2D view region.
   * Shows density background + stars appropriate for the scale.
   */
  _getTileImage(cx, cz, viewSize) {
    const key = `${cx.toFixed(3)},${cz.toFixed(3)},${viewSize.toFixed(3)}`;
    if (this._tileImageCache.has(key)) {
      return this._tileImageCache.get(key);
    }

    const RES = 128;
    const canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(RES, RES);
    const ext = viewSize / 2;

    // Render density
    let maxD = 0;
    const grid = new Float64Array(RES * RES);
    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const gx = cx + (px / RES - 0.5) * viewSize;
        const gz = cz - (py / RES - 0.5) * viewSize;
        const d = this._galaxyDensity(gx, gz);
        grid[py * RES + px] = d;
        if (d > maxD) maxD = d;
      }
    }
    if (maxD < 1e-10) maxD = 1;

    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const d = grid[py * RES + px];
        const norm = Math.log(1 + d * 80) / Math.log(1 + maxD * 80);
        const b = Math.pow(norm, 0.65) * 0.35;

        const gx = cx + (px / RES - 0.5) * viewSize;
        const gz = cz - (py / RES - 0.5) * viewSize;
        const R = Math.sqrt(gx * gx + gz * gz);
        const theta = Math.atan2(gz, gx);
        const armStr = this._gm.spiralArmStrength(R, theta);

        let r, g, bl;
        if (R < 1.5) {
          r = 255 * b; g = 220 * b; bl = 150 * b;
        } else {
          const ab = armStr * 0.3;
          r = (200 - ab * 80) * b; g = (210 - ab * 40) * b; bl = (220 + ab * 35) * b;
        }

        const idx = (py * RES + px) * 4;
        imgData.data[idx] = r; imgData.data[idx + 1] = g;
        imgData.data[idx + 2] = bl; imgData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);

    // Stars are drawn at full resolution on the main canvas, not here.
    // This cache stores only the density background.

    // LRU eviction
    if (this._tileImageCache.size >= this._tileCacheMax) {
      const oldest = this._tileImageCache.keys().next().value;
      this._tileImageCache.delete(oldest);
    }
    this._tileImageCache.set(key, canvas);
    return canvas;
  }

  // ════════════════════════════════════════════════════
  // DENSITY + TILE SIZING
  // ════════════════════════════════════════════════════

  _galaxyDensity(x, z) {
    const R = Math.sqrt(x * x + z * z);
    const theta = Math.atan2(z, x);
    // All density modulation (arms, bar, truncation) is built into
    // potentialDerivedDensity when theta is provided. No separate
    // arm multiplication or edge fade needed.
    const d = this._gm.potentialDerivedDensity(R, 0, theta);
    return d.totalDensity;
  }

  /**
   * Compute tile size for a given position and target star count.
   * Returns tile width in kpc.
   */
  _computeTileSize(x, z, targetStars = 100) {
    const density = this._galaxyDensity(x, z);
    if (density < 1e-10) return 0.02; // very sparse — large tiles
    // Approximate: starsPerPc3 ≈ density * calibrationFactor
    const starsPerPc3 = Math.max(0.001, density * 0.14 / 0.065);
    const volumePc3 = targetStars / starsPerPc3;
    return Math.cbrt(volumePc3) / 1000; // pc to kpc
  }

  // ════════════════════════════════════════════════════
  // 2D LEVEL RENDERING (Galaxy, Sector, Region)
  // ════════════════════════════════════════════════════

  _render2DLevel(ctx, w, h) {
    const cx = this._viewCenter.x;
    const cz = this._viewCenter.z;
    const viewSize = this._viewSize;
    const ext = viewSize / 2;
    const drawSize = Math.min(w, h) - 80; // leave room for tabs
    const ox = (w - drawSize) / 2;
    const oy = 10;
    const scale = drawSize / viewSize;

    // Density background (cached at 128px, scaled up)
    this._renderDensityBg(ctx, ox, oy, drawSize, cx, cz, ext);

    // No individual stars at 2D levels — luminosity image provides the visual

    // Sector overlay on galaxy level
    if (this._levelIndex === 0) {
      this._renderSectorOverlay(ctx, ox, oy, drawSize, cx, cz, ext);
    } else {
      // Grid tiles — region uses 16x16, sector uses 8x8
      const gn = gridNForLevel(this._levelIndex);
      const tileW = drawSize / gn;
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= gn; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * tileW, oy);
        ctx.lineTo(ox + i * tileW, oy + drawSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * tileW);
        ctx.lineTo(ox + drawSize, oy + i * tileW);
        ctx.stroke();
      }

      // Hovered tile
      if (this._hoveredTile) {
        const { col, row } = this._hoveredTile;
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(ox + col * tileW, oy + row * tileW, tileW, tileW);

        // Tile info
        const tileSize = viewSize / gn;
        const tileCx = cx - ext + (col + 0.5) * tileSize;
        const tileCz = cz + ext - (row + 0.5) * tileSize;
        const label = `(${tileCx.toFixed(1)}, ${tileCz.toFixed(1)})`;
        ctx.font = '11px "DotGothic16", monospace';
        ctx.fillStyle = 'rgba(100, 180, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(label, ox + (col + 0.5) * tileW, oy + row * tileW - 4);
        ctx.textAlign = 'left';
      }
    }

    // Player marker
    const px = ox + (this._playerX - cx + ext) / viewSize * drawSize;
    const pz = oy + (-(this._playerZ - cz) + ext) / viewSize * drawSize;
    if (px >= ox - 20 && px <= ox + drawSize + 20 && pz >= oy - 20 && pz <= oy + drawSize + 20) {
      this._drawPlayerMarker(ctx, px, pz);
    } else {
      // Arrow pointing toward player
      this._drawPlayerArrow(ctx, ox, oy, drawSize, px, pz);
    }

    // External warp target indicator (green diamond)
    const target = this._externalTarget;
    if (target) {
      const tx = ox + (target.x - cx + ext) / viewSize * drawSize;
      const tz = oy + (-(target.z - cz) + ext) / viewSize * drawSize;
      if (tx >= ox - 10 && tx <= ox + drawSize + 10 && tz >= oy - 10 && tz <= oy + drawSize + 10) {
        this._drawTargetMarker(ctx, tx, tz);
      } else {
        // Arrow pointing toward target
        this._drawTargetArrow(ctx, ox, oy, drawSize, tx, tz);
      }
    }
  }

  _renderDensityBg(ctx, ox, oy, drawSize, cx, cz, ext) {
    // Per-view luminosity image: each zoom level gets its own render
    // at the exact spatial extent being viewed.
    const map = this._getOrRenderMap(cx, cz, ext);
    ctx.imageSmoothingEnabled = true;
    // Black background — luminosity image has transparency for dim regions
    ctx.fillStyle = '#000';
    ctx.fillRect(ox, oy, drawSize, drawSize);
    ctx.drawImage(map, 0, 0, this._mapRes, this._mapRes, ox, oy, drawSize, drawSize);
  }

  _getOrRenderMap(cx, cz, ext) {
    // Use GPU galaxy renderer if available — matches the in-game galaxy model
    if (this._navGalaxyRenderer) {
      return this._navGalaxyRenderer.render(cx, cz, ext);
    }

    // Fallback: CPU luminosity renderer
    const qcx = Math.round(cx * 10) / 10;
    const qcz = Math.round(cz * 10) / 10;
    const qext = Math.round(ext * 100) / 100;
    const key = `${qcx},${qcz},${qext}`;

    if (this._mapCache.has(key)) {
      const entry = this._mapCache.get(key);
      entry.lastUsed = Date.now();
      return entry.canvas;
    }

    const compOverrides = {};
    if (ext < 10) {
      compOverrides.arms = { gain: 4.0, stretch: 400 };
      compOverrides.disk = { gain: 3.0, stretch: 350 };
    }
    if (ext < 2) {
      compOverrides.arms = { gain: 5.0, stretch: 500, gamma: 0.6 };
      compOverrides.disk = { gain: 4.0, stretch: 400 };
      compOverrides.core = { gain: 0.2 };
    }
    const canvas = this._luminosityRenderer.render(cx, cz, ext, this._mapRes, {
      dustStrength: ext > 10 ? 0.5 : ext > 2 ? 0.3 : 0.1,
      noiseStrength: ext > 10 ? 0.4 : ext > 2 ? 0.6 : 0.8,
      components: compOverrides,
    });

    this._mapCache.set(key, { canvas, lastUsed: Date.now() });
    if (this._mapCache.size > this._mapCacheMax) {
      let oldest = null, oldestTime = Infinity;
      for (const [k, v] of this._mapCache) {
        if (v.lastUsed < oldestTime) { oldest = k; oldestTime = v.lastUsed; }
      }
      if (oldest) this._mapCache.delete(oldest);
    }

    return canvas;
  }



  /**
   * Render stars at full canvas resolution for 2D levels.
   * Instead of findStarsInRadius (which clusters near center),
   * sample the hash grid across the visible area using a grid of
   * small search regions. This distributes stars across the whole view.
   */
  _renderScaleStars(ctx, ox, oy, drawSize, cx, cz, ext) {
    const viewSize = ext * 2;

    // Divide the view into a grid of sample points.
    // At each point, query a small radius for the brightest star types
    // that are searchable at this scale.
    const sampleN = 16; // 16x16 sample grid
    const sampleSize = viewSize / sampleN;
    const searchRadius = sampleSize * 0.6; // slight overlap

    const spectralColors = {
      O: '#94b4ff', B: '#b0c4ff', A: '#d0d8ff', F: '#fff5e0',
      G: '#ffefb0', K: '#ffc480', M: '#ff9664',
      Kg: '#ffa050', Gg: '#ffd880', Mg: '#ff6030',
    };

    for (let sy = 0; sy < sampleN; sy++) {
      for (let sx = 0; sx < sampleN; sx++) {
        const sampleCx = cx - ext + (sx + 0.5) * sampleSize;
        const sampleCz = cz + ext - (sy + 0.5) * sampleSize;

        // Skip samples outside the galaxy
        const R = Math.sqrt(sampleCx * sampleCx + sampleCz * sampleCz);
        if (R > 16) continue;

        const stars = HashGridStarfield.findStarsInRadius(
          this._gm, { x: sampleCx, y: 0, z: sampleCz }, searchRadius, 20
        );

        for (const s of stars) {
          const spx = ox + (s.worldX - cx + ext) / viewSize * drawSize;
          const spy = oy + (-(s.worldZ - cz) + ext) / viewSize * drawSize;
          if (spx < ox || spx > ox + drawSize || spy < oy || spy > oy + drawSize) continue;

          const dotR = s.type === 'O' ? 3 :
                       s.type === 'B' || s.type === 'Kg' || s.type === 'Mg' ? 2.5 :
                       s.type === 'A' || s.type === 'Gg' ? 2 : 1.5;

          ctx.fillStyle = spectralColors[s.type] || '#ff9664';
          ctx.beginPath();
          ctx.arc(spx, spy, dotR, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _renderSectorOverlay(ctx, ox, oy, drawSize, cx, cz, ext) {
    const sectors = this._sectors.getSectorsInBounds(
      cx - ext, cx + ext, cz - ext, cz + ext
    );

    for (const s of sectors) {
      const sx = ox + (s.centerX - cx + ext) / (ext * 2) * drawSize;
      const sy = oy + (-(s.centerZ - cz) + ext) / (ext * 2) * drawSize;
      const sw = s.size / (ext * 2) * drawSize;

      // Sector boundary
      const bx = ox + (s.minX - cx + ext) / (ext * 2) * drawSize;
      const by = oy + (-(s.maxZ - cz) + ext) / (ext * 2) * drawSize;

      // Highlight current sector
      if (this._currentSector && s.id === this._currentSector.id) {
        ctx.strokeStyle = 'rgba(0, 255, 128, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, sw, sw);
      } else {
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.1)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(bx, by, sw, sw);
      }

      // Hover detection
      if (this._mouseX >= bx && this._mouseX <= bx + sw &&
          this._mouseY >= by && this._mouseY <= by + sw) {
        this._hoveredTile = { sector: s };
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, sw, sw);

        // Sector name tooltip
        ctx.font = '12px "DotGothic16", monospace';
        ctx.fillStyle = 'rgba(100, 180, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(s.name, sx, by - 4);
        ctx.textAlign = 'left';
      }
    }
  }

  // ════════════════════════════════════════════════════
  // LOCAL (3D Star Map)
  // ════════════════════════════════════════════════════

  _renderLocal(ctx, w, h) {
    const cx = this._localCenter.x;
    const cy = this._localCenter.y;
    const cz = this._localCenter.z;
    const rad = this._localRadius;
    const drawH = h - 50; // leave room for tabs

    // On-demand loading: query stars for the visible Y range + margin.
    // Expands automatically as the user scrolls with R/F.
    const yWindowHalf = rad * 2; // matches render window below
    this._ensureStarsLoaded(cx, cy, cz, yWindowHalf);


    // 3D projection — orbit around the block center, not the camera position.
    // The camera can WASD around within the block, but rotation always pivots
    // around the column's central axis.
    const blockCenter = this._viewStack[2]?.center || { x: cx, z: cz };
    const orbitX = blockCenter.x;
    const orbitZ = blockCenter.z;

    const cosX = Math.cos(this._localRotX), sinX = Math.sin(this._localRotX);
    const cosY = Math.cos(this._localRotY), sinY = Math.sin(this._localRotY);
    const viewSize = Math.min(w, drawH) * 0.85;
    const projScale = viewSize / (rad * 2);
    const centerSX = w / 2, centerSY = drawH / 2;
    const planeY = 0;

    // Camera offset from orbit center (the WASD panning)
    const camOffX = cx - orbitX;
    const camOffZ = cz - orbitZ;

    const project = (wx, wy, wz) => {
      // Position relative to orbit center
      let rx = wx - orbitX, ry = wy - cy, rz = wz - orbitZ;
      // Rotate around the orbit center
      let tx = rx * cosY - rz * sinY; rz = rx * sinY + rz * cosY; rx = tx;
      let ty = ry * cosX - rz * sinX; rz = ry * sinX + rz * cosX; ry = ty;
      // Apply camera offset (rotated into camera space) to shift the view
      const offRX = camOffX * cosY - camOffZ * sinY;
      const offRZ = camOffX * sinY + camOffZ * cosY;
      rx -= offRX;
      rz -= offRZ;
      return { x: centerSX + rx * projScale, y: centerSY - ry * projScale, depth: rz };
    };

    // ── DEBUG MODE: bold plane + player dot + direction indicators ──
    // Toggle with backtick key while in local view
    if (this._localDebug) {
      // Grid at fixed world coordinates — fixed cell size, zoom shows more/fewer
      const cellSize = this._localGridCell; // fixed world-space cell size (kpc)
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
      ctx.lineWidth = 1;
      const gridMinX = Math.floor((cx - rad * 2) / cellSize) * cellSize;
      const gridMaxX = Math.ceil((cx + rad * 2) / cellSize) * cellSize;
      const gridMinZ = Math.floor((cz - rad * 2) / cellSize) * cellSize;
      const gridMaxZ = Math.ceil((cz + rad * 2) / cellSize) * cellSize;
      for (let gx = gridMinX; gx <= gridMaxX; gx += cellSize) {
        const p1 = project(gx, planeY, gridMinZ);
        const p2 = project(gx, planeY, gridMaxZ);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
      }
      for (let gz = gridMinZ; gz <= gridMaxZ; gz += cellSize) {
        const p3 = project(gridMinX, planeY, gz);
        const p4 = project(gridMaxX, planeY, gz);
        ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
      }

      // Highlight the cell the player is centered in
      const playerCellX = Math.floor(cx / cellSize) * cellSize;
      const playerCellZ = Math.floor(cz / cellSize) * cellSize;
      ctx.strokeStyle = 'rgba(0, 255, 128, 0.3)';
      ctx.lineWidth = 2;
      const c0 = project(playerCellX, planeY, playerCellZ);
      const c1 = project(playerCellX + cellSize, planeY, playerCellZ);
      const c2 = project(playerCellX + cellSize, planeY, playerCellZ + cellSize);
      const c3 = project(playerCellX, planeY, playerCellZ + cellSize);
      ctx.beginPath();
      ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y);
      ctx.lineTo(c2.x, c2.y); ctx.lineTo(c3.x, c3.y);
      ctx.closePath(); ctx.stroke();

      // Player dot stays at screen center (you ARE the center)
      const debugP = { x: centerSX, y: centerSY };
      ctx.fillStyle = '#00ff80';
      ctx.beginPath(); ctx.arc(debugP.x, debugP.y, 6, 0, Math.PI * 2); ctx.fill();

      // Forward direction line (where W takes you) — projected from center
      const fwdDist = rad * 0.5;
      const camAngle = this._localRotY;
      const fwdWorldX = cx + (-Math.sin(camAngle)) * fwdDist;
      const fwdWorldZ = cz + (-Math.cos(camAngle)) * fwdDist;
      const fwdP = project(fwdWorldX, planeY, fwdWorldZ);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(centerSX, centerSY); ctx.lineTo(fwdP.x, fwdP.y); ctx.stroke();
      ctx.fillStyle = '#ff4444';
      ctx.font = '14px "DotGothic16", monospace';
      ctx.fillText('W (forward)', fwdP.x + 5, fwdP.y - 5);

      // Right direction line (where D takes you)
      const rightWorldX = cx + Math.cos(camAngle) * fwdDist;
      const rightWorldZ = cz + (-Math.sin(camAngle)) * fwdDist;
      const rightP = project(rightWorldX, planeY, rightWorldZ);
      ctx.strokeStyle = '#4444ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(centerSX, centerSY); ctx.lineTo(rightP.x, rightP.y); ctx.stroke();
      ctx.fillStyle = '#4444ff';
      ctx.fillText('D (right)', rightP.x + 5, rightP.y - 5);

      // Position label + key debug
      ctx.fillStyle = '#fff';
      ctx.font = '12px "DotGothic16", monospace';
      ctx.fillText(`pos: (${(cx*1000).toFixed(1)}, ${(cz*1000).toFixed(1)}) pc`, 16, drawH - 46);
      ctx.fillText(`rotY: ${(this._localRotY * 180 / Math.PI).toFixed(0)}°  rotX: ${(this._localRotX * 180 / Math.PI).toFixed(0)}°`, 16, drawH - 30);
      ctx.fillText(`keys: [${[...this._heldKeys].join(', ')}]  radius: ${(rad*1000).toFixed(1)} pc`, 16, drawH - 14);
      ctx.fillText('DEBUG: ` to toggle', w - 160, drawH - 14);

      // Skip star rendering in debug mode
      this._renderLevelTabs(ctx, w, h);
      this._renderHUD(ctx, w, h);
      return;
    }

    // Reference grid at the galactic plane (y=0), anchored to block center
    // Extends well beyond the block to always fill the screen regardless of orbit angle
    const cellSize = this._localGridCell;
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.18)';
    ctx.lineWidth = 1;
    const gridExtent = Math.max(rad * 3, this._localCubeSize * 2);
    const gMinX = Math.floor((orbitX - gridExtent) / cellSize) * cellSize;
    const gMaxX = Math.ceil((orbitX + gridExtent) / cellSize) * cellSize;
    const gMinZ = Math.floor((orbitZ - gridExtent) / cellSize) * cellSize;
    const gMaxZ = Math.ceil((orbitZ + gridExtent) / cellSize) * cellSize;
    for (let gx = gMinX; gx <= gMaxX; gx += cellSize) {
      const p1 = project(gx, planeY, gMinZ);
      const p2 = project(gx, planeY, gMaxZ);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
    for (let gz = gMinZ; gz <= gMaxZ; gz += cellSize) {
      const p3 = project(gMinX, planeY, gz);
      const p4 = project(gMaxX, planeY, gz);
      ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
    }

    // Y window: only render stars within the visible vertical band.
    // yWindowHalf already computed above for the loading query.
    const viewCenterY = cy;

    // Filter to Y window, then project and sort
    const visible = this._localStars.filter(s =>
      Math.abs(s.wy - viewCenterY) <= yWindowHalf
    );

    const projected = visible.map(s => ({
      star: s,
      starP: project(s.wx, s.wy, s.wz),
      planeP: project(s.wx, planeY, s.wz),
    }));
    projected.sort((a, b) => b.starP.depth - a.starP.depth);

    this._hoveredLocalStar = null;
    const hitDist = 12;

    for (const { star, starP, planeP } of projected) {
      // Vertical reference line (subtle)
      ctx.setLineDash([2, 5]);
      ctx.strokeStyle = star.wy >= planeY ? 'rgba(100, 200, 150, 0.12)' : 'rgba(200, 100, 100, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(planeP.x, planeP.y); ctx.lineTo(starP.x, starP.y); ctx.stroke();
      ctx.setLineDash([]);

      // Plane dot
      ctx.fillStyle = 'rgba(100, 180, 255, 0.2)';
      ctx.beginPath(); ctx.arc(planeP.x, planeP.y, 1.5, 0, Math.PI * 2); ctx.fill();

      // Star — real named stars are slightly larger
      const isSelected = this._selectedNavStar === star;
      const baseRadius = star.isReal ? 4.5 : 3.5;
      const drawR = isSelected ? baseRadius + 1 : baseRadius;

      if (star._isBinary) {
        // Binary: draw two slightly offset dots instead of one
        const offset = drawR * 0.7; // separation between the pair
        // Primary dot
        ctx.fillStyle = star.color;
        ctx.beginPath(); ctx.arc(starP.x - offset, starP.y, drawR * 0.8, 0, Math.PI * 2); ctx.fill();
        // Companion dot — use companion spectral color if available, else dimmer primary
        const s2Color = star._star2Type
          ? (NavComputer._SPECTRAL_COLORS[star._star2Type] || star.color)
          : star.color;
        ctx.fillStyle = s2Color;
        ctx.beginPath(); ctx.arc(starP.x + offset, starP.y, drawR * 0.65, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = star.color;
        ctx.beginPath(); ctx.arc(starP.x, starP.y, drawR, 0, Math.PI * 2); ctx.fill();
      }

      // Real named stars: always show name label in gold/amber
      if (star.isReal && star.name) {
        ctx.font = '10px "DotGothic16", monospace';
        ctx.fillStyle = '#ffc850'; // gold/amber
        ctx.textAlign = 'left';
        ctx.fillText(star.name, starP.x + baseRadius + 4, starP.y + 3);
        // Subtle amber glow ring
        ctx.strokeStyle = 'rgba(255, 200, 80, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(starP.x, starP.y, baseRadius + 2, 0, Math.PI * 2); ctx.stroke();
      }

      // Selected star: green highlight ring
      if (isSelected) {
        const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.15;
        ctx.strokeStyle = '#00ff80';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(starP.x, starP.y, 10 * pulse, 0, Math.PI * 2); ctx.stroke();
        // Inner ring
        ctx.strokeStyle = 'rgba(0, 255, 128, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(starP.x, starP.y, 6, 0, Math.PI * 2); ctx.stroke();
      }

      // Hover check
      const dx = this._mouseX - starP.x, dy = this._mouseY - starP.y;
      if (dx * dx + dy * dy < hitDist * hitDist) {
        this._hoveredLocalStar = { star, sx: starP.x, sy: starP.y };
      }
    }

    // Player marker
    const playerP = project(this._playerX, this._playerY, this._playerZ);
    this._drawPlayerMarker(ctx, playerP.x, playerP.y, 8);

    // Selected star info banner (shown below HUD)
    if (this._selectedNavStar) {
      const s = this._selectedNavStar;
      ctx.font = '11px "DotGothic16", monospace';
      ctx.fillStyle = '#00ff80';
      ctx.textAlign = 'center';
      ctx.fillText('WARP TARGET', w / 2, drawH - 24);
      ctx.font = '14px "DotGothic16", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(s.name || 'Unnamed', w / 2, drawH - 8);
      ctx.textAlign = 'left';
    }

    // Hover tooltip
    if (this._hoveredLocalStar) {
      const { star, sx, sy } = this._hoveredLocalStar;
      const tooltipLines = [
        `${star.spectral} class`,
        `${star.distPc} pc (${(star.dist * 1000 * 3.26).toFixed(1)} ly)`,
        `${((star.wy - planeY) * 1000).toFixed(0)} pc ${star.wy >= planeY ? 'above' : 'below'} plane`,
      ];
      if (star._isBinary) {
        tooltipLines.push(`Binary (${star.spectral}+${star._star2Type || '?'})`);
      }
      this._drawTooltip(ctx, sx, sy, star.name || 'Unnamed', tooltipLines);
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.stroke();
    }

    // Unified column minimap
    this._renderColumnMinimap(ctx, w, drawH);
  }

  // ════════════════════════════════════════════════════
  // SYSTEM VIEW (Level 4)
  // ════════════════════════════════════════════════════

  _renderSystem(ctx, w, h) {
    const drawH = h - 50;

    // Generate system data on first render
    if (!this._systemData && this._systemStar) {
      const star = this._systemStar;
      // Use actual spawned system data for the current system (avoids regeneration mismatch)
      if (this._isCurrentSystem() && this._currentSystemData) {
        this._systemData = this._currentSystemData;
        console.log('[NAV] Using actual system data:', this._systemData.planets?.length, 'planets');
      } else {
        console.log('[NAV] Generating system for', star.name, '...');
        const galaxyCtx = this._gm.deriveGalaxyContext({ x: star.wx, y: star.wy, z: star.wz });
        galaxyCtx.starTypeOverride = star.spectral;
        try {
          this._systemData = StarSystemGenerator.generate(String(star.seed), galaxyCtx);
          console.log('[NAV] System generated:', this._systemData.planets?.length, 'planets');
        } catch (e) {
          console.warn('[NAV] System generation failed:', e);
          this._systemData = { star: { type: star.spectral, radiusSolar: 1, color: [1, 1, 0.8] }, planets: [], zones: {} };
        }
      }
    }
    if (!this._systemData) {
      console.warn('[NAV] No system data and no star — skipping render');
      return;
    }

    if (this._systemMode === 'planet') {
      this._renderPlanetDetail(ctx, w, h);
      return;
    }

    const sys = this._systemData;
    const planets = sys.planets || [];
    const zones = sys.zones || {};
    const starName = this._systemStar?.name || 'Unknown';

    // ── 3D projection setup ──
    const cosX = Math.cos(this._systemRotX), sinX = Math.sin(this._systemRotX);
    const cosY = Math.cos(this._systemRotY), sinY = Math.sin(this._systemRotY);
    const viewSize = Math.min(w, drawH) * 0.85;
    const centerSX = w / 2, centerSY = drawH / 2;

    // Scale: sqrt(AU) compression so inner + outer planets both visible
    const maxOrbitAU = planets.length > 0
      ? Math.max(...planets.map(p => p.orbitRadiusAU))
      : 5;
    const maxR = Math.sqrt(maxOrbitAU) * 1.2 || 3;
    const projScale = ((viewSize / 2) / maxR) * this._systemZoom;

    const auToScreen = (au) => Math.sqrt(au);

    const project = (wx, wy, wz) => {
      let rx = wx, ry = wy, rz = wz;
      let tx = rx * cosY - rz * sinY; rz = rx * sinY + rz * cosY; rx = tx;
      let ty = ry * cosX - rz * sinX; rz = ry * sinX + rz * cosX; ry = ty;
      return { x: centerSX + rx * projScale, y: centerSY - ry * projScale, depth: rz };
    };

    const planetColors = {
      'rocky': '#a09080', 'terrestrial': '#4a8a4a', 'ocean': '#3060b0',
      'ice': '#b0c8e0', 'lava': '#d04020', 'venus': '#c0a050',
      'gas-giant': '#c09060', 'hot-jupiter': '#e06030', 'sub-neptune': '#5090c0',
      'carbon': '#606060', 'volcanic': '#b03010', 'eyeball': '#80a0c0',
    };

    // ── Habitable zone ring ──
    if (zones.hzInnerAU && zones.hzOuterAU) {
      const SEGS = 64;
      for (const hzAU of [zones.hzInnerAU, zones.hzOuterAU]) {
        const r = auToScreen(hzAU);
        ctx.strokeStyle = 'rgba(50, 180, 80, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let s = 0; s <= SEGS; s++) {
          const a = (s / SEGS) * Math.PI * 2;
          const p = project(Math.cos(a) * r, 0, Math.sin(a) * r);
          if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      // Fill between inner and outer
      ctx.fillStyle = 'rgba(50, 180, 80, 0.04)';
      ctx.beginPath();
      const rInner = auToScreen(zones.hzInnerAU);
      const rOuter = auToScreen(zones.hzOuterAU);
      for (let s = 0; s <= SEGS; s++) {
        const a = (s / SEGS) * Math.PI * 2;
        const p = project(Math.cos(a) * rOuter, 0, Math.sin(a) * rOuter);
        if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      for (let s = SEGS; s >= 0; s--) {
        const a = (s / SEGS) * Math.PI * 2;
        const p = project(Math.cos(a) * rInner, 0, Math.sin(a) * rInner);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
    }

    // ── Asteroid belt zones ──
    const belts = sys.asteroidBelts || [];
    for (const belt of belts) {
      const innerAU = belt.physics?.innerAU || 0;
      const outerAU = belt.physics?.outerAU || 0;
      if (innerAU <= 0 || outerAU <= 0) continue;

      const beltColor = belt.isKuiper
        ? 'rgba(120, 140, 180, 0.06)'   // icy blue-gray for Kuiper belt
        : 'rgba(180, 140, 80, 0.06)';   // dusty amber for main belt
      const lineColor = belt.isKuiper
        ? 'rgba(120, 140, 180, 0.18)'
        : 'rgba(180, 140, 80, 0.18)';
      const labelColor = belt.isKuiper
        ? 'rgba(120, 140, 180, 0.4)'
        : 'rgba(180, 140, 80, 0.4)';

      const BELT_SEGS = 48;
      const rInner = auToScreen(innerAU);
      const rOuter = auToScreen(outerAU);

      // Ring borders
      for (const r of [rInner, rOuter]) {
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let s = 0; s <= BELT_SEGS; s++) {
          const a = (s / BELT_SEGS) * Math.PI * 2;
          const p = project(Math.cos(a) * r, 0, Math.sin(a) * r);
          if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }

      // Fill between inner and outer
      ctx.fillStyle = beltColor;
      ctx.beginPath();
      for (let s = 0; s <= BELT_SEGS; s++) {
        const a = (s / BELT_SEGS) * Math.PI * 2;
        const p = project(Math.cos(a) * rOuter, 0, Math.sin(a) * rOuter);
        if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      for (let s = BELT_SEGS; s >= 0; s--) {
        const a = (s / BELT_SEGS) * Math.PI * 2;
        const p = project(Math.cos(a) * rInner, 0, Math.sin(a) * rInner);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();

      // Label
      const labelAngle = Math.PI * 0.25; // 45° position
      const labelR = (rInner + rOuter) / 2;
      const labelP = project(Math.cos(labelAngle) * labelR, 0, Math.sin(labelAngle) * labelR);
      ctx.font = '8px "DotGothic16", monospace';
      ctx.fillStyle = labelColor;
      ctx.textAlign = 'center';
      ctx.fillText(belt.isKuiper ? 'KUIPER BELT' : 'ASTEROID BELT', labelP.x, labelP.y - 6);
    }

    // ── Orbit circles (wireframe) ──
    const ORBIT_SEGS = 48;
    for (let i = 0; i < planets.length; i++) {
      const r = auToScreen(planets[i].orbitRadiusAU);
      const isSelected = i === this._selectedPlanetIdx;
      ctx.strokeStyle = isSelected ? 'rgba(100, 180, 255, 0.5)' : 'rgba(100, 180, 255, 0.15)';
      ctx.lineWidth = isSelected ? 1.5 : 1;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      for (let s = 0; s <= ORBIT_SEGS; s++) {
        const a = (s / ORBIT_SEGS) * Math.PI * 2;
        const p = project(Math.cos(a) * r, 0, Math.sin(a) * r);
        if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ── Stars (primary + optional binary companion) ──
    const starColor = sys.star?.color || [1, 0.9, 0.7];
    const starR = Math.max(6, Math.min(16, (sys.star?.radiusSolar || 1) * 5));

    // Binary star positions: offset from barycenter using separation + mass ratio
    let star1Wx = 0, star1Wz = 0;
    let star2Wx = 0, star2Wz = 0;
    if (sys.isBinary && sys.star2) {
      const q = sys.binaryMassRatio || 0.5;
      const sepAU = sys.binarySeparationAU || 0.3;
      const sep = auToScreen(sepAU);
      const r1 = sep * q / (1 + q);     // primary offset from barycenter
      const r2 = sep * 1.0 / (1 + q);   // secondary offset from barycenter
      const angle = sys.binaryOrbitAngle || 0;
      star1Wx = Math.cos(angle) * r1;
      star1Wz = Math.sin(angle) * r1;
      star2Wx = -Math.cos(angle) * r2;
      star2Wz = -Math.sin(angle) * r2;
    }

    const starP = project(star1Wx, 0, star1Wz);

    // Primary star glow
    const grad = ctx.createRadialGradient(starP.x, starP.y, 0, starP.x, starP.y, starR * 3);
    grad.addColorStop(0, `rgba(${Math.round(starColor[0]*255)},${Math.round(starColor[1]*255)},${Math.round(starColor[2]*255)},0.3)`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(starP.x, starP.y, starR * 3, 0, Math.PI * 2); ctx.fill();

    // Primary star body
    ctx.fillStyle = `rgb(${Math.round(starColor[0]*255)},${Math.round(starColor[1]*255)},${Math.round(starColor[2]*255)})`;
    ctx.beginPath(); ctx.arc(starP.x, starP.y, starR, 0, Math.PI * 2); ctx.fill();

    // ── Binary companion star ──
    let star2P = null;
    let star2R = 0;
    if (sys.isBinary && sys.star2) {
      const s2Color = sys.star2.color || [1, 0.7, 0.5];
      star2R = Math.max(4, Math.min(12, (sys.star2.radiusSolar || 0.5) * 5));
      star2P = project(star2Wx, 0, star2Wz);

      // Companion glow
      const grad2 = ctx.createRadialGradient(star2P.x, star2P.y, 0, star2P.x, star2P.y, star2R * 3);
      grad2.addColorStop(0, `rgba(${Math.round(s2Color[0]*255)},${Math.round(s2Color[1]*255)},${Math.round(s2Color[2]*255)},0.25)`);
      grad2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad2;
      ctx.beginPath(); ctx.arc(star2P.x, star2P.y, star2R * 3, 0, Math.PI * 2); ctx.fill();

      // Companion body
      ctx.fillStyle = `rgb(${Math.round(s2Color[0]*255)},${Math.round(s2Color[1]*255)},${Math.round(s2Color[2]*255)})`;
      ctx.beginPath(); ctx.arc(star2P.x, star2P.y, star2R, 0, Math.PI * 2); ctx.fill();

      // Subtle orbit rings for binary pair (dashed)
      const q = sys.binaryMassRatio || 0.5;
      const sepAU = sys.binarySeparationAU || 0.3;
      const sep = auToScreen(sepAU);
      const orbitR1 = sep * q / (1 + q);
      const orbitR2 = sep * 1.0 / (1 + q);
      const ORBIT_SEGS_BIN = 32;
      ctx.setLineDash([2, 3]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.5;
      for (const orbitR of [orbitR1, orbitR2]) {
        ctx.beginPath();
        for (let s = 0; s <= ORBIT_SEGS_BIN; s++) {
          const a = (s / ORBIT_SEGS_BIN) * Math.PI * 2;
          const p = project(Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR);
          if (s === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // ── Planets (depth-sorted) ──
    this._hoveredBody = null;
    const hitDist = 14;

    const planetProj = planets.map((p, i) => {
      const r = auToScreen(p.orbitRadiusAU);
      const angle = p.orbitAngle || 0;
      const wx = Math.cos(angle) * r;
      const wz = Math.sin(angle) * r;
      const sp = project(wx, 0, wz);
      return { planet: p, index: i, sp, wx, wz };
    });
    planetProj.sort((a, b) => b.sp.depth - a.sp.depth);

    for (const { planet: p, index: i, sp, wx, wz } of planetProj) {
      const pd = p.planetData;
      const baseR = Math.max(4, Math.min(12, 3 + Math.log2(Math.max(0.5, pd.radiusEarth)) * 2.5));
      const pColor = planetColors[pd.type] || '#808080';

      // Planet body
      ctx.fillStyle = pColor;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, baseR, 0, Math.PI * 2); ctx.fill();

      // Wireframe outline
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sp.x, sp.y, baseR, 0, Math.PI * 2); ctx.stroke();

      // Ring indicator
      if (pd.rings) {
        ctx.strokeStyle = 'rgba(200, 180, 150, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, baseR + 5, baseR * 0.3, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Moons — small dots on 3D-projected orbits around the planet
      if (p.moons && p.moons.length > 0) {
        const MOON_ORBIT_SEGS = 32;
        for (let m = 0; m < p.moons.length; m++) {
          const moon = p.moons[m];
          // Use actual orbit data with sqrt compression, matching _renderPlanetDetail
          const moonOrbitWorld = Math.sqrt(moon.orbitRadiusEarth || (10 + m * 8));
          // Scale moon orbits down so they're visible but compact in system view
          // Planet orbits use auToScreen (sqrt of AU); moon orbits are in Earth-radii,
          // so we need a conversion factor to make them visible relative to the planet
          const moonOrbitScale = (baseR + 6 + m * 4) / (moonOrbitWorld * projScale);
          const moonOrbitR = moonOrbitWorld * moonOrbitScale;

          // 3D-projected orbit circle (tilts with rotation like planet orbits)
          ctx.strokeStyle = 'rgba(150, 150, 150, 0.12)';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          for (let s = 0; s <= MOON_ORBIT_SEGS; s++) {
            const a = (s / MOON_ORBIT_SEGS) * Math.PI * 2;
            const moWx = wx + Math.cos(a) * moonOrbitR;
            const moWz = wz + Math.sin(a) * moonOrbitR;
            const moP = project(moWx, 0, moWz);
            if (s === 0) ctx.moveTo(moP.x, moP.y); else ctx.lineTo(moP.x, moP.y);
          }
          ctx.stroke();

          // Moon position on its orbit (use startAngle for deterministic placement)
          const moonAngle = moon.startAngle || (m * 2.4 + 0.7);
          const moonWx = wx + Math.cos(moonAngle) * moonOrbitR;
          const moonWz = wz + Math.sin(moonAngle) * moonOrbitR;
          const moonP = project(moonWx, 0, moonWz);

          // Moon dot
          const moonR = Math.max(1.5, Math.min(3, 1 + (moon.radiusEarth || 0.1) * 3));
          ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
          ctx.beginPath(); ctx.arc(moonP.x, moonP.y, moonR, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Planet label
      ctx.font = '9px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(`${starName}-${i + 1}`, sp.x, sp.y + baseR + 12);

      // Hover detection
      const mdx = this._mouseX - sp.x, mdy = this._mouseY - sp.y;
      if (mdx * mdx + mdy * mdy < hitDist * hitDist) {
        this._hoveredBody = { type: 'planet', index: i, sx: sp.x, sy: sp.y };
      }
    }

    // Star hover (primary)
    const sdx = this._mouseX - starP.x, sdy = this._mouseY - starP.y;
    if (sdx * sdx + sdy * sdy < (starR + 4) * (starR + 4)) {
      this._hoveredBody = { type: 'star', index: 0, sx: starP.x, sy: starP.y };
    }
    // Star hover (binary companion)
    if (star2P) {
      const s2dx = this._mouseX - star2P.x, s2dy = this._mouseY - star2P.y;
      if (s2dx * s2dx + s2dy * s2dy < (star2R + 4) * (star2R + 4)) {
        this._hoveredBody = { type: 'star', index: 1, sx: star2P.x, sy: star2P.y };
      }
    }

    // ── Hover: leader line callout ──
    if (this._hoveredBody) {
      const hb = this._hoveredBody;
      let title, lines;
      if (hb.type === 'planet') {
        const p = planets[hb.index];
        const pd = p.planetData;
        title = `${starName}-${hb.index + 1}`;
        lines = [
          `${pd.type} · ${pd.radiusEarth.toFixed(1)} R⊕`,
          `${p.orbitRadiusAU.toFixed(2)} AU`,
        ];
        if (pd.T_eq) lines.push(`${Math.round(pd.T_eq)} K`);
        if (pd.habitability > 0.3) lines.push(`Habitability: ${(pd.habitability * 100).toFixed(0)}%`);
        if (p.moons?.length > 0) lines.push(`${p.moons.length} moon${p.moons.length > 1 ? 's' : ''}`);
        if (pd.rings) lines.push('Ringed');
        // Highlight ring on hovered planet
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(hb.sx, hb.sy, 10, 0, Math.PI * 2); ctx.stroke();
      } else if (hb.index === 1 && sys.isBinary && sys.star2) {
        // Companion star hover
        title = starName + ' B';
        lines = [
          `${sys.star2.type} class (companion)`,
          `${(sys.star2.radiusSolar || 0.5).toFixed(2)} R☉`,
          `Sep: ${(sys.binarySeparationAU || 0).toFixed(3)} AU`,
        ];
      } else {
        // Primary star hover
        title = starName + (sys.isBinary ? ' A' : '');
        lines = [
          `${sys.star.type} class${sys.isBinary ? ' (primary)' : ''}`,
          `${(sys.star.radiusSolar || 1).toFixed(2)} R☉`,
          `Age: ${(sys.ageGyr || 0).toFixed(1)} Gyr`,
          `${planets.length} planet${planets.length !== 1 ? 's' : ''}`,
        ];
        if (sys.isBinary) lines.push('Binary system');
      }
      this._drawLeaderCallout(ctx, hb.sx, hb.sy, title, lines, w, drawH);
    }

    // ── Ship position indicator + trajectory line ──
    const isCurrent = this._isCurrentSystem();
    if (isCurrent) {
      // Compute ship's projected position based on which body the player is near
      let shipP = null;
      if (this._currentFocusIndex === -2 || this._currentFocusIndex === -1) {
        // At star or system overview — ship is at center
        shipP = project(0, 0, 0);
      } else if (this._currentFocusIndex >= 0 && this._currentFocusIndex < planets.length) {
        const cp = planets[this._currentFocusIndex];
        const cpR = auToScreen(cp.orbitRadiusAU);
        const cpAngle = cp.orbitAngle || 0;
        const cpWx = Math.cos(cpAngle) * cpR;
        const cpWz = Math.sin(cpAngle) * cpR;

        if (this._currentMoonIndex >= 0 && cp.moons && this._currentMoonIndex < cp.moons.length) {
          // At a moon — offset from planet position
          // Must match the moon orbit formula used in rendering (lines 1465-1474)
          const moon = cp.moons[this._currentMoonIndex];
          const baseR = Math.max(4, Math.min(12, 3 + Math.log2(Math.max(0.5, cp.planetData.radiusEarth)) * 2.5));
          const moonOrbitWorld = Math.sqrt(moon.orbitRadiusEarth || (10 + this._currentMoonIndex * 8));
          const moonOrbitScale = (baseR + 6 + this._currentMoonIndex * 4) / (moonOrbitWorld * projScale);
          const moonOrbitR = moonOrbitWorld * moonOrbitScale;
          const moonAngle = moon.startAngle || (this._currentMoonIndex * 2.4 + 0.7);
          const moonWx = cpWx + Math.cos(moonAngle) * moonOrbitR;
          const moonWz = cpWz + Math.sin(moonAngle) * moonOrbitR;
          shipP = project(moonWx, 0, moonWz);
        } else {
          // At a planet
          shipP = project(cpWx, 0, cpWz);
        }
      }

      // Draw ship diamond indicator
      if (shipP) {
        const s = 5; // half-size of diamond
        ctx.fillStyle = '#00ff80';
        ctx.strokeStyle = '#00ff80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shipP.x, shipP.y - s * 1.4); // top
        ctx.lineTo(shipP.x + s, shipP.y);        // right
        ctx.lineTo(shipP.x, shipP.y + s * 0.8);  // bottom
        ctx.lineTo(shipP.x - s, shipP.y);        // left
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Small "SHIP" label
        ctx.font = '7px "DotGothic16", monospace';
        ctx.fillStyle = 'rgba(0, 255, 128, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('SHIP', shipP.x, shipP.y + s * 0.8 + 10);
        ctx.textAlign = 'left';

        // ── Trajectory line from ship to hovered/selected body ──
        const target = this._hoveredBody || this._selectedBody;
        if (target) {
          let destP = null;
          if (target.type === 'star') {
            destP = starP; // center of system
          } else if (target.type === 'planet') {
            const ti = target.index ?? target.planetIndex;
            if (ti >= 0 && ti < planets.length) {
              const tp = planets[ti];
              const tR = auToScreen(tp.orbitRadiusAU);
              const tAngle = tp.orbitAngle || 0;
              destP = project(Math.cos(tAngle) * tR, 0, Math.sin(tAngle) * tR);
            }
          }
          if (destP) {
            // Dashed trajectory line — green for burn (current system)
            const trajColor = '#00ff80';
            ctx.strokeStyle = trajColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 4]);
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(shipP.x, shipP.y);
            ctx.lineTo(destP.x, destP.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            // Small arrowhead at destination end
            const adx = destP.x - shipP.x, ady = destP.y - shipP.y;
            const len = Math.sqrt(adx * adx + ady * ady);
            if (len > 20) {
              const ux = adx / len, uy = ady / len;
              const arrowLen = 8;
              const arrowW = 4;
              const tipX = destP.x - ux * 12; // offset from body center
              const tipY = destP.y - uy * 12;
              ctx.fillStyle = trajColor;
              ctx.globalAlpha = 0.6;
              ctx.beginPath();
              ctx.moveTo(tipX, tipY);
              ctx.lineTo(tipX - ux * arrowLen + uy * arrowW, tipY - uy * arrowLen - ux * arrowW);
              ctx.lineTo(tipX - ux * arrowLen - uy * arrowW, tipY - uy * arrowLen + ux * arrowW);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }
          }
        }
      }
    }

    // ── Header ──
    ctx.font = '14px "DotGothic16", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(starName, 16, 24);
    ctx.font = '11px "DotGothic16", monospace';
    ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
    const starTypeLabel = sys.isBinary && sys.star2
      ? `${sys.star?.type || '?'}+${sys.star2.type} binary`
      : `${sys.star?.type || '?'}`;
    ctx.fillText(`${starTypeLabel} · ${planets.length} planet${planets.length !== 1 ? 's' : ''} · ${(sys.ageGyr || 0).toFixed(1)} Gyr`, 16, 42);

    // ── Selection ring on selected body ──
    if (this._selectedBody) {
      const selColor = isCurrent ? '#00ff80' : 'rgba(100, 180, 255, 0.9)';
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
      ctx.strokeStyle = selColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = pulse;
      if (this._selectedBody.type === 'star') {
        const idx = this._selectedBody.starIndex || 0;
        const sp = idx === 1 && star2P ? star2P : starP;
        const sr = idx === 1 ? star2R : starR;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sr + 6, 0, Math.PI * 2); ctx.stroke();
      } else if (this._selectedBody.type === 'planet') {
        const proj = planetProj.find(p => p.index === this._selectedBody.planetIndex);
        if (proj) {
          const pr = Math.max(4, Math.min(12, 3 + Math.log2(Math.max(0.5, proj.planet.planetData.radiusEarth)) * 2.5));
          ctx.beginPath(); ctx.arc(proj.sp.x, proj.sp.y, pr + 5, 0, Math.PI * 2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ── COMMIT button + hint ──
    // Foreign system: always show COMMIT WARP (warp to the star)
    if (!isCurrent && !this._commitAction) {
      this._selectedBody = { type: 'star', starIndex: 0 };
      this._commitAction = this._buildCommitAction();
      this._selectedNavStar = this._systemStar;
    }
    if (this._selectedBody && this._commitAction) {
      // Draw COMMIT button
      const btnText = isCurrent ? '[ COMMIT BURN ]' : '[ COMMIT WARP ]';
      const btnColor = isCurrent ? '#00ff80' : 'rgba(100, 180, 255, 0.9)';
      const btnW = 180, btnH = 28;
      const btnX = (w - btnW) / 2, btnY = drawH - 52;
      ctx.fillStyle = isCurrent ? 'rgba(0, 255, 128, 0.1)' : 'rgba(100, 180, 255, 0.1)';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = btnColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.font = '12px "DotGothic16", monospace';
      ctx.fillStyle = btnColor;
      ctx.textAlign = 'center';
      ctx.fillText(btnText, w / 2, btnY + 19);
      this._commitButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      // Hint below button
      ctx.font = '10px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText('DRAG TO ROTATE · ESC TO RETURN', w / 2, drawH - 8);
    } else {
      this._commitButtonRect = null;
      ctx.font = '10px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'center';
      if (isCurrent) {
        ctx.fillText('SELECT BODY TO NAVIGATE · DRAG TO ROTATE · ESC TO RETURN', w / 2, drawH - 8);
      } else {
        ctx.fillText('SELECT STAR TO WARP · CLICK PLANET FOR DETAIL · ESC TO RETURN', w / 2, drawH - 8);
      }
    }
    ctx.textAlign = 'left';
  }

  // ── Planet detail sub-view ──
  _renderPlanetDetail(ctx, w, h) {
    const drawH = h - 50;
    const sys = this._systemData;
    const planets = sys.planets || [];
    const idx = this._selectedPlanetIdx;
    if (idx < 0 || idx >= planets.length) { this._systemMode = 'system'; return; }

    const p = planets[idx];
    const pd = p.planetData;
    const moons = p.moons || [];
    const starName = this._systemStar?.name || 'Unknown';

    // ── 3D projection (same as system view) ──
    const cosX = Math.cos(this._systemRotX), sinX = Math.sin(this._systemRotX);
    const cosY = Math.cos(this._systemRotY), sinY = Math.sin(this._systemRotY);
    const viewSize = Math.min(w, drawH) * 0.7;
    const centerSX = w / 2, centerSY = drawH / 2;

    // Scale based on outermost moon orbit
    const maxMoonR = moons.length > 0
      ? Math.max(...moons.map(m => m.orbitRadiusEarth || 20)) * 1.3
      : 30;
    const projScale = ((viewSize / 2) / Math.sqrt(maxMoonR)) * this._systemZoom;

    const project = (wx, wy, wz) => {
      let rx = wx, ry = wy, rz = wz;
      let tx = rx * cosY - rz * sinY; rz = rx * sinY + rz * cosY; rx = tx;
      let ty = ry * cosX - rz * sinX; rz = ry * sinX + rz * cosX; ry = ty;
      return { x: centerSX + rx * projScale, y: centerSY - ry * projScale, depth: rz };
    };

    // ── Planet at center ──
    const planetP = project(0, 0, 0);
    const planetR = Math.max(12, Math.min(30, 8 + Math.log2(Math.max(0.5, pd.radiusEarth)) * 6));

    const planetColors = {
      'rocky': '#a09080', 'terrestrial': '#4a8a4a', 'ocean': '#3060b0',
      'ice': '#b0c8e0', 'lava': '#d04020', 'venus': '#c0a050',
      'gas-giant': '#c09060', 'hot-jupiter': '#e06030', 'sub-neptune': '#5090c0',
      'carbon': '#606060', 'volcanic': '#b03010', 'eyeball': '#80a0c0',
    };
    const pColor = planetColors[pd.type] || '#808080';

    // Planet body
    ctx.fillStyle = pColor;
    ctx.beginPath(); ctx.arc(planetP.x, planetP.y, planetR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(planetP.x, planetP.y, planetR, 0, Math.PI * 2); ctx.stroke();

    // Rings
    if (pd.rings) {
      ctx.strokeStyle = 'rgba(200, 180, 150, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(planetP.x, planetP.y, planetR * 1.6, planetR * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // ── Moon orbits + moons ──
    const ORBIT_SEGS = 36;
    this._hoveredBody = null;

    for (let m = 0; m < moons.length; m++) {
      const moon = moons[m];
      const moonOrbitR = Math.sqrt(moon.orbitRadiusEarth || (10 + m * 8));

      // Orbit circle
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      for (let s = 0; s <= ORBIT_SEGS; s++) {
        const a = (s / ORBIT_SEGS) * Math.PI * 2;
        const mp = project(Math.cos(a) * moonOrbitR, 0, Math.sin(a) * moonOrbitR);
        if (s === 0) ctx.moveTo(mp.x, mp.y); else ctx.lineTo(mp.x, mp.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Moon position
      const moonAngle = moon.startAngle || (m * 2.4);
      const mx = Math.cos(moonAngle) * moonOrbitR;
      const mz = Math.sin(moonAngle) * moonOrbitR;
      const moonP = project(mx, 0, mz);
      const moonR = Math.max(3, Math.min(8, 2 + Math.log2(Math.max(0.1, moon.radiusEarth || 0.3)) * 2));

      ctx.fillStyle = '#b0b0b0';
      ctx.beginPath(); ctx.arc(moonP.x, moonP.y, moonR, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(moonP.x, moonP.y, moonR, 0, Math.PI * 2); ctx.stroke();

      // Moon label
      ctx.font = '8px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(moon.type || 'moon', moonP.x, moonP.y + moonR + 10);

      // Moon hover
      const mdx = this._mouseX - moonP.x, mdy = this._mouseY - moonP.y;
      if (mdx * mdx + mdy * mdy < 10 * 10) {
        this._hoveredBody = { type: 'moon', index: m, sx: moonP.x, sy: moonP.y };
      }
    }
    // Moon hover tooltip
    if (this._hoveredBody && this._hoveredBody.type === 'moon') {
      const moon = moons[this._hoveredBody.index];
      const lines = [
        moon.type || 'moon',
        `${(moon.radiusEarth || 0.1).toFixed(2)} R⊕`,
      ];
      if (moon.isPlanetMoon) lines.push('Planet-class moon');
      this._drawTooltip(ctx, this._hoveredBody.sx, this._hoveredBody.sy, `${starName}-${idx + 1}${String.fromCharCode(97 + this._hoveredBody.index)}`, lines);
    }

    // ── Ship position indicator + trajectory line (planet detail) ──
    const isCurrent = this._isCurrentSystem();
    if (isCurrent && this._currentFocusIndex === idx) {
      let shipP = null;
      if (this._currentMoonIndex >= 0 && this._currentMoonIndex < moons.length) {
        // Ship is at a specific moon
        const shipMoon = moons[this._currentMoonIndex];
        const shipMoonOrbitR = Math.sqrt(shipMoon.orbitRadiusEarth || (10 + this._currentMoonIndex * 8));
        const shipMoonAngle = shipMoon.startAngle || (this._currentMoonIndex * 2.4);
        const smx = Math.cos(shipMoonAngle) * shipMoonOrbitR;
        const smz = Math.sin(shipMoonAngle) * shipMoonOrbitR;
        shipP = project(smx, 0, smz);
      } else {
        // Ship is at the planet itself (center)
        shipP = planetP;
      }

      if (shipP) {
        // Draw ship diamond
        const s = 5;
        ctx.fillStyle = '#00ff80';
        ctx.strokeStyle = '#00ff80';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(shipP.x, shipP.y - s * 1.4);
        ctx.lineTo(shipP.x + s, shipP.y);
        ctx.lineTo(shipP.x, shipP.y + s * 0.8);
        ctx.lineTo(shipP.x - s, shipP.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.font = '7px "DotGothic16", monospace';
        ctx.fillStyle = 'rgba(0, 255, 128, 0.6)';
        ctx.textAlign = 'center';
        ctx.fillText('SHIP', shipP.x, shipP.y + s * 0.8 + 10);
        ctx.textAlign = 'left';

        // Trajectory line to hovered/selected moon
        const target = this._hoveredBody || this._selectedBody;
        if (target) {
          let destP = null;
          if (target.type === 'moon') {
            const mi = target.index ?? target.moonIndex;
            if (mi >= 0 && mi < moons.length) {
              const tm = moons[mi];
              const tmOrbitR = Math.sqrt(tm.orbitRadiusEarth || (10 + mi * 8));
              const tmAngle = tm.startAngle || (mi * 2.4);
              destP = project(Math.cos(tmAngle) * tmOrbitR, 0, Math.sin(tmAngle) * tmOrbitR);
            }
          } else if (target.type === 'planet') {
            destP = planetP;
          }
          if (destP) {
            const trajColor = '#00ff80';
            ctx.strokeStyle = trajColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([6, 4]);
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(shipP.x, shipP.y);
            ctx.lineTo(destP.x, destP.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1.0;

            const adx = destP.x - shipP.x, ady = destP.y - shipP.y;
            const len = Math.sqrt(adx * adx + ady * ady);
            if (len > 20) {
              const ux = adx / len, uy = ady / len;
              const tipX = destP.x - ux * 12;
              const tipY = destP.y - uy * 12;
              ctx.fillStyle = trajColor;
              ctx.globalAlpha = 0.6;
              ctx.beginPath();
              ctx.moveTo(tipX, tipY);
              ctx.lineTo(tipX - ux * 8 + uy * 4, tipY - uy * 8 - ux * 4);
              ctx.lineTo(tipX - ux * 8 - uy * 4, tipY - uy * 8 + ux * 4);
              ctx.closePath();
              ctx.fill();
              ctx.globalAlpha = 1.0;
            }
          }
        }
      }
    }

    // ── Header ──
    ctx.font = '14px "DotGothic16", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(`${starName}-${idx + 1}`, 16, 24);
    ctx.font = '11px "DotGothic16", monospace';
    ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
    ctx.fillText(`${pd.type} · ${pd.radiusEarth.toFixed(1)} R⊕ · ${(p.orbitRadiusAU).toFixed(2)} AU · ${moons.length} moon${moons.length !== 1 ? 's' : ''}`, 16, 42);
    if (pd.T_eq) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillText(`${Math.round(pd.T_eq)} K${pd.habitability > 0.3 ? ' · Habitable' : ''}`, 16, 58);
    }

    // ── Selection ring on selected moon ──
    if (isCurrent && this._selectedBody && this._selectedBody.type === 'moon') {
      const selMoonIdx = this._selectedBody.moonIndex;
      if (selMoonIdx >= 0 && selMoonIdx < moons.length) {
        const moon = moons[selMoonIdx];
        // Same orbit + projection as moon rendering above
        const selOrbitR = Math.sqrt(moon.orbitRadiusEarth || (10 + selMoonIdx * 8));
        const selAngle = moon.startAngle || (selMoonIdx * 2.4);
        const selP = project(Math.cos(selAngle) * selOrbitR, 0, Math.sin(selAngle) * selOrbitR);
        const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
        ctx.strokeStyle = '#00ff80';
        ctx.lineWidth = 2;
        ctx.globalAlpha = pulse;
        ctx.beginPath(); ctx.arc(selP.x, selP.y, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // ── Hint ──
    ctx.font = '10px "DotGothic16", monospace';
    // ── COMMIT button + hint ──
    if (isCurrent && this._selectedBody && this._commitAction) {
      const btnText = '[ COMMIT BURN ]';
      const btnW = 180, btnH = 28;
      const btnX = (w - btnW) / 2, btnY = drawH - 52;
      ctx.fillStyle = 'rgba(0, 255, 128, 0.1)';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = '#00ff80';
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.font = '12px "DotGothic16", monospace';
      ctx.fillStyle = '#00ff80';
      ctx.textAlign = 'center';
      ctx.fillText(btnText, w / 2, btnY + 19);
      this._commitButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };

      ctx.font = '10px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillText('ESC TO GO BACK', w / 2, drawH - 8);
    } else {
      this._commitButtonRect = null;
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.textAlign = 'center';
      if (isCurrent) {
        ctx.fillText('SELECT MOON TO NAVIGATE · ESC TO GO BACK', w / 2, drawH - 8);
      } else {
        ctx.fillText('VIEW ONLY · ESC TO GO BACK', w / 2, drawH - 8);
      }
    }
    ctx.textAlign = 'left';
  }

  _renderColumnMinimap(ctx, w, h) {
    // Guard: skip minimap when no stars are loaded
    if (this._localStars.length === 0) return;

    const cubeHalf = this._localCubeSize || 0.01;
    const blockCenter = this._viewStack[2]?.center || this._localCenter;

    // Find Y extent of all stars
    let minStarY = Infinity, maxStarY = -Infinity;
    for (const s of this._localStars) {
      if (s.wy < minStarY) minStarY = s.wy;
      if (s.wy > maxStarY) maxStarY = s.wy;
    }
    // Ensure stable range — pad to ±5 pc around center if too narrow
    let yRange = maxStarY - minStarY;
    if (yRange < 0.01) {
      const mid = (minStarY + maxStarY) / 2;
      minStarY = mid - 0.005;
      maxStarY = mid + 0.005;
      yRange = 0.01;
    }

    // Column minimap dimensions — tall and narrow, like the actual column shape
    const xzSize = 60;  // width of XZ plane representation
    const ySize = 160;   // height of the full column
    const mapX = w - xzSize - 20;
    const mapY = h - ySize - 60;

    // Background
    ctx.fillStyle = 'rgba(10, 15, 25, 0.85)';
    ctx.fillRect(mapX - 6, mapY - 16, xzSize + 12, ySize + 36);

    ctx.font = '9px "DotGothic16", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'center';
    ctx.fillText('COLUMN', mapX + xzSize / 2, mapY - 4);

    // Draw the column as a 3D-ish shape: front face + top face
    // Front face = XZ plane seen from the side (shows height + one horizontal axis)
    // We'll show it as a rectangle: width = XZ extent, height = Y extent

    // Column outline
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mapX, mapY, xzSize, ySize);

    // Galactic plane line (y=0) — horizontal line across the column
    const planeScreenY = mapY + ySize * (1 - (0 - minStarY) / yRange);
    ctx.strokeStyle = 'rgba(100, 200, 150, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mapX, planeScreenY);
    ctx.lineTo(mapX + xzSize, planeScreenY);
    ctx.stroke();
    ctx.setLineDash([]);

    // The XZ position maps to horizontal position in the column
    // We project both X and Z onto one horizontal axis using the camera angle
    // so the minimap "rotates" with your view
    const camAngle = this._localRotY;
    const cosC = Math.cos(camAngle);
    const sinC = Math.sin(camAngle);

    // Camera XZ position → horizontal position in minimap
    // Project the 2D XZ offset onto the camera's right axis
    const camDX = (this._localCenter.x - blockCenter.x) / cubeHalf;
    const camDZ = (this._localCenter.z - blockCenter.z) / cubeHalf;
    // Rotate into camera space: "right" component shows as horizontal
    const camRight = camDX * cosC + camDZ * sinC;
    const camFwd = -camDX * sinC + camDZ * cosC;

    const camScreenX = mapX + xzSize / 2 + camRight * xzSize / 2;
    const camScreenY = mapY + ySize * (1 - (this._localCenter.y - minStarY) / yRange);

    // View window rectangle
    const viewW = Math.max(6, (this._localRadius / cubeHalf) * xzSize);
    const viewH = Math.min(ySize - 4, Math.max(4, (this._localRadius * 4 / yRange) * ySize));

    ctx.fillStyle = 'rgba(100, 180, 255, 0.15)';
    ctx.fillRect(camScreenX - viewW / 2, camScreenY - viewH / 2, viewW, viewH);
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(camScreenX - viewW / 2, camScreenY - viewH / 2, viewW, viewH);

    // Camera dot
    ctx.fillStyle = '#64b4ff';
    ctx.beginPath();
    ctx.arc(camScreenX, camScreenY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Forward direction indicator (small line from dot)
    const fwdLen = 8;
    ctx.strokeStyle = '#64b4ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(camScreenX, camScreenY);
    // Forward in the minimap = toward the "depth" axis, shown as upward tilt
    ctx.lineTo(camScreenX + camFwd * 6, camScreenY - fwdLen);
    ctx.stroke();

    // Player home position
    const playerDX = (this._playerX - blockCenter.x) / cubeHalf;
    const playerDZ = (this._playerZ - blockCenter.z) / cubeHalf;
    const playerRight = playerDX * cosC + playerDZ * sinC;
    const playerScreenX = mapX + xzSize / 2 + playerRight * xzSize / 2;
    const playerScreenY = mapY + ySize * (1 - (this._playerY - minStarY) / yRange);

    ctx.fillStyle = '#00ff80';
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Height labels
    ctx.font = '8px "DotGothic16", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'right';
    ctx.fillText((maxStarY * 1000).toFixed(0) + ' pc', mapX - 3, mapY + 8);
    ctx.fillText((minStarY * 1000).toFixed(0) + ' pc', mapX - 3, mapY + ySize);
    ctx.fillText('0', mapX - 3, planeScreenY + 3);

    // Current height label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64b4ff';
    const heightPc = (this._localCenter.y * 1000).toFixed(0);
    ctx.fillText(heightPc + ' pc', mapX + xzSize + 4, camScreenY + 3);

    // Controls hint
    ctx.font = '9px "DotGothic16", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.textAlign = 'center';
    ctx.fillText('WASD move · R/F up/down', mapX + xzSize / 2, mapY + ySize + 12);
    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════
  // ON-DEMAND COLUMN LOADING
  // ════════════════════════════════════════════════════

  static _SPECTRAL_COLORS = {
    O: '#94b4ff', B: '#b0c4ff', A: '#d0d8ff', F: '#fff5e0',
    G: '#ffefb0', K: '#ffc480', M: '#ff9664',
    Kg: '#ffa050', Gg: '#ffd880', Mg: '#ff6030',
  };

  /**
   * Ensure stars are loaded for the visible Y range around viewY ± yHalf.
   * On first call, queries the visible range synchronously (fast, small window).
   * Then schedules background expansion to pre-load above and below.
   */
  _ensureStarsLoaded(cx, cy, cz, yHalf) {
    const blockCenter = this._viewStack[2]?.center || { x: cx, z: cz };
    const blockHalf = this._localCubeSize || 0.005;

    // If block changed (navigated to new block), reset everything
    if (!this._loadBlockCenter ||
        this._loadBlockCenter.x !== blockCenter.x ||
        this._loadBlockCenter.z !== blockCenter.z) {
      this._localStars = [];
      this._loadedSeen = new Set();
      this._loadedYMin = null;
      this._loadedYMax = null;
      this._loadBlockCenter = { ...blockCenter };
      this._loadBlockHalf = blockHalf;
      this._estimatedBlockStars = this._estimateBlockStarCount(blockCenter, blockHalf);
      this._cancelBgExpand();
    }

    // Add margin so scrolling doesn't immediately need a new query
    const margin = yHalf;
    const needMin = cy - yHalf - margin;
    const needMax = cy + yHalf + margin;

    if (this._loadedYMin === null) {
      // First load — query the visible range synchronously
      this._queryYRange(needMin, needMax);
      console.log(`[NAV] Initial load: ${this._localStars.length} stars (Y: ${(needMin * 1000).toFixed(0)} to ${(needMax * 1000).toFixed(0)} pc)`);
      this._tryAutoSelectExternalTarget();
      // Start background expansion
      this._scheduleBgExpand();
      return;
    }

    // Extend if the view has scrolled beyond loaded range
    if (needMin < this._loadedYMin) {
      this._queryYRange(needMin, this._loadedYMin);
    }
    if (needMax > this._loadedYMax) {
      this._queryYRange(this._loadedYMax, needMax);
    }
  }

  /**
   * Query the hash grid for stars in a Y band and merge into _localStars.
   * Updates _loadedYMin/_loadedYMax to track the total loaded range.
   */
  _queryYRange(yMin, yMax) {
    const bc = this._loadBlockCenter;
    const bh = this._loadBlockHalf;
    const centerY = (yMin + yMax) / 2;
    const halfY = (yMax - yMin) / 2;

    if (halfY <= 0) return;

    const stars = HashGridStarfield.findStarsInColumn(
      this._gm, { x: bc.x, y: centerY, z: bc.z }, bh, halfY, 50000
    );

    for (const s of stars) {
      const key = `${s.seed}-${s.worldX.toFixed(6)}`;
      if (!this._loadedSeen.has(key)) {
        this._loadedSeen.add(key);
        let name = '';
        try { name = generateSystemName(this._makeRng(s.seed), { x: s.worldX, y: s.worldY, z: s.worldZ }); } catch {}
        this._localStars.push({
          wx: s.worldX, wy: s.worldY, wz: s.worldZ,
          name, spectral: s.type,
          color: NavComputer._SPECTRAL_COLORS[s.type] || '#ff9664',
          seed: s.seed, dist: s.dist,
          distPc: (s.dist * 1000).toFixed(0),
        });
      }
    }

    // ── Real star overlay ──
    // Check if any named real stars fall within this block volume.
    // If a real star is near an existing hash-grid star (within 2 pc = 0.002 kpc),
    // replace that star's name. Otherwise, add the real star as a new entry.
    if (this._realStarCatalog && this._realStarCatalog.loaded) {
      const realStars = this._realStarCatalog.findInVolume(
        { x: bc.x, y: centerY, z: bc.z }, bh, halfY
      );
      const MATCH_DIST = 0.002; // 2 pc in kpc
      for (const rs of realStars) {
        if (!rs.name) continue; // skip unnamed catalog entries
        const realKey = `real-${rs.name}`;
        if (this._loadedSeen.has(realKey)) continue;
        this._loadedSeen.add(realKey);

        // Try to find the nearest hash-grid star to replace
        let bestIdx = -1, bestDist = MATCH_DIST;
        for (let i = 0; i < this._localStars.length; i++) {
          const ls = this._localStars[i];
          if (ls.isReal) continue; // don't match against other real stars
          const dx = ls.wx - rs.x, dy = ls.wy - rs.y, dz = ls.wz - rs.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }

        if (bestIdx >= 0) {
          // Replace the hash-grid star's name with the real name
          this._localStars[bestIdx].name = rs.name;
          this._localStars[bestIdx].isReal = true;
          if (rs.spect) {
            this._localStars[bestIdx].spectral = rs.spect;
            this._localStars[bestIdx].color = NavComputer._SPECTRAL_COLORS[rs.spect] || '#ff9664';
          }
        } else {
          // No nearby match — add as a new star entry
          const dx = rs.x - this._playerX, dy = rs.y - this._playerY, dz = rs.z - this._playerZ;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          this._localStars.push({
            wx: rs.x, wy: rs.y, wz: rs.z,
            name: rs.name, spectral: rs.spect || '?',
            color: NavComputer._SPECTRAL_COLORS[rs.spect] || '#ff9664',
            seed: Math.round(rs.x * 10000) ^ Math.round(rs.z * 10000),
            dist, distPc: (dist * 1000).toFixed(0),
            isReal: true,
          });
        }
      }
    }

    // Expand tracked range
    if (this._loadedYMin === null) {
      this._loadedYMin = yMin;
      this._loadedYMax = yMax;
    } else {
      this._loadedYMin = Math.min(this._loadedYMin, yMin);
      this._loadedYMax = Math.max(this._loadedYMax, yMax);
    }
  }

  /** Background-expand the loaded range one step at a time. */
  _scheduleBgExpand() {
    this._cancelBgExpand();
    const MAX_Y = 3.0; // GalacticMap.GALAXY_HEIGHT
    const STEP = 0.1;  // 100 pc per background step

    this._bgLoadTimer = setTimeout(() => {
      this._bgLoadTimer = null;
      if (this._loadedYMin === null) return;

      let expanded = false;
      // Expand downward
      if (this._loadedYMin > -MAX_Y) {
        const newMin = Math.max(-MAX_Y, this._loadedYMin - STEP);
        this._queryYRange(newMin, this._loadedYMin);
        expanded = true;
      }
      // Expand upward
      if (this._loadedYMax < MAX_Y) {
        const newMax = Math.min(MAX_Y, this._loadedYMax + STEP);
        this._queryYRange(this._loadedYMax, newMax);
        expanded = true;
      }

      if (expanded) {
        this._scheduleBgExpand(); // continue expanding
      } else {
        console.log(`[NAV] Column fully loaded: ${this._localStars.length} stars`);
      }
    }, 0);
  }

  _cancelBgExpand() {
    if (this._bgLoadTimer !== null) {
      clearTimeout(this._bgLoadTimer);
      this._bgLoadTimer = null;
    }
  }

  /** Full reset — clears all loaded stars and column state. */
  _resetColumnLoad() {
    this._cancelBgExpand();
    this._loadedYMin = null;
    this._loadedYMax = null;
    this._loadedSeen = new Set();
    this._loadBlockCenter = null;
    this._loadBlockHalf = null;
    this._estimatedBlockStars = null;
  }

  /**
   * Estimate total star count in the full block column by integrating
   * the density model. Fast — just samples the potential, no hash grid.
   */
  _estimateBlockStarCount(blockCenter, blockHalf) {
    const MAX_Y = 3.0; // kpc
    const SAMPLES = 24; // Y samples across ±3 kpc
    const step = (MAX_Y * 2) / SAMPLES;
    const R = Math.sqrt(blockCenter.x * blockCenter.x + blockCenter.z * blockCenter.z);
    const theta = Math.atan2(blockCenter.z, blockCenter.x || 1e-10);
    const blockVolPerSlice = (blockHalf * 2) * (blockHalf * 2) * step; // kpc³

    let totalDensity = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const y = -MAX_Y + (i + 0.5) * step;
      const d = this._gm.potentialDerivedDensity(R, y, theta);
      totalDensity += d.totalDensity; // stars/pc³
    }

    // Average density × total volume, converting kpc³ to pc³
    const avgDensity = totalDensity / SAMPLES; // stars/pc³
    const totalVolPc3 = (blockHalf * 2 * 1000) * (blockHalf * 2 * 1000) * (MAX_Y * 2 * 1000);
    return Math.round(avgDensity * totalVolPc3);
  }

  /**
   * Compute grid line spacing that keeps ~8-12 lines visible regardless of zoom.
   * Snaps to "nice" values (1, 2, 5, 10, 20, 50... in parsecs).
   */
  _adaptiveGridStep(viewRadius) {
    const viewDiameter = viewRadius * 2 * 1000; // in parsecs
    const targetLines = 10;
    const rawStep = viewDiameter / targetLines;

    // Snap to nearest "nice" number: 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50...
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let nice;
    if (norm < 1.5) nice = 1;
    else if (norm < 3.5) nice = 2;
    else if (norm < 7.5) nice = 5;
    else nice = 10;

    return nice * mag / 1000; // convert back to kpc
  }

  // ════════════════════════════════════════════════════
  // DRAWING HELPERS
  // ════════════════════════════════════════════════════

  _drawPlayerMarker(ctx, x, y, size = 10) {
    const pulse = 1 + Math.sin(Date.now() * 0.003) * 0.2;
    ctx.strokeStyle = '#00ff80';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, (size - 2) * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - size, y); ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size); ctx.lineTo(x, y + size);
    ctx.stroke();
    ctx.fillStyle = '#00ff80';
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
  }

  /**
   * Draw a green diamond marker for the warp target at 2D levels.
   */
  _drawTargetMarker(ctx, x, y, size = 8) {
    const pulse = 1 + Math.sin(Date.now() * 0.004) * 0.2;
    const s = size * pulse;

    // Outer diamond
    ctx.strokeStyle = '#00ff80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.stroke();

    // Inner dot
    ctx.fillStyle = '#00ff80';
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();

    // Label
    if (this._externalTarget?.name) {
      ctx.font = '10px "DotGothic16", monospace';
      ctx.fillStyle = '#00ff80';
      ctx.textAlign = 'center';
      ctx.fillText(this._externalTarget.name, x, y - s - 4);
      ctx.textAlign = 'left';
    }
  }

  /**
   * Draw an arrow at the edge of the 2D view pointing toward the off-screen target.
   */
  _drawTargetArrow(ctx, ox, oy, size, tx, tz) {
    const cx = ox + size / 2, cy = oy + size / 2;
    const angle = Math.atan2(tz - cy, tx - cx);
    const edgeX = cx + Math.cos(angle) * (size / 2 - 10);
    const edgeY = cy + Math.sin(angle) * (size / 2 - 10);

    ctx.fillStyle = '#00ff80';
    ctx.beginPath();
    ctx.moveTo(edgeX + Math.cos(angle) * 6, edgeY + Math.sin(angle) * 6);
    ctx.lineTo(edgeX - Math.cos(angle) * 4 + Math.sin(angle) * 4,
               edgeY - Math.sin(angle) * 4 - Math.cos(angle) * 4);
    ctx.lineTo(edgeX - Math.cos(angle) * 4 - Math.sin(angle) * 4,
               edgeY - Math.sin(angle) * 4 + Math.cos(angle) * 4);
    ctx.closePath();
    ctx.fill();
  }

  _drawPlayerArrow(ctx, ox, oy, size, px, pz) {
    // Clamp to edge and draw arrow
    const cx = ox + size / 2, cy = oy + size / 2;
    const angle = Math.atan2(pz - cy, px - cx);
    const edgeX = cx + Math.cos(angle) * (size / 2 - 10);
    const edgeY = cy + Math.sin(angle) * (size / 2 - 10);

    ctx.fillStyle = '#00ff80';
    ctx.beginPath();
    ctx.arc(edgeX, edgeY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Small arrow
    ctx.strokeStyle = '#00ff80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(edgeX, edgeY);
    ctx.lineTo(edgeX - Math.cos(angle) * 12 + Math.sin(angle) * 5,
               edgeY - Math.sin(angle) * 12 - Math.cos(angle) * 5);
    ctx.moveTo(edgeX, edgeY);
    ctx.lineTo(edgeX - Math.cos(angle) * 12 - Math.sin(angle) * 5,
               edgeY - Math.sin(angle) * 12 + Math.cos(angle) * 5);
    ctx.stroke();
  }

  _drawTooltip(ctx, sx, sy, title, lines) {
    const maxLen = Math.max(title.length, ...lines.map(l => l.length));
    const boxW = maxLen * 8.5 + 24;
    const boxH = (lines.length + 1) * 18 + 14;
    const tx = Math.min(sx + 15, this._canvas.width - boxW - 10);
    const ty = Math.max(sy - boxH / 2, 10);

    ctx.fillStyle = 'rgba(10, 12, 20, 0.92)';
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(tx, ty, boxW, boxH, 4); ctx.fill(); ctx.stroke();

    ctx.font = '13px "DotGothic16", monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(title, tx + 12, ty + 18);
    ctx.fillStyle = 'rgba(100, 180, 255, 0.8)';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], tx + 12, ty + 36 + i * 18);
    }
  }

  /**
   * Draw a leader line callout — label floats to the side of the object,
   * connected by a thin line. Position chosen to avoid going off-screen.
   */
  _drawLeaderCallout(ctx, objX, objY, title, lines, canvasW, canvasH) {
    const maxLen = Math.max(title.length, ...lines.map(l => l.length));
    const boxW = maxLen * 8 + 24;
    const boxH = (lines.length + 1) * 16 + 14;
    const leaderLen = 50; // distance from object to label
    const margin = 12;

    // Choose direction: prefer upper-right, but adapt to screen edges
    let dirX = 1, dirY = -1;
    if (objX + leaderLen + boxW + margin > canvasW) dirX = -1;
    if (objY - leaderLen - boxH - margin < 0) dirY = 1;

    // Leader line endpoint (elbow point)
    const elbowX = objX + dirX * leaderLen;
    const elbowY = objY + dirY * leaderLen * 0.6;

    // Box position: anchored at the elbow
    const boxX = dirX > 0 ? elbowX : elbowX - boxW;
    const boxY = dirY < 0 ? elbowY - boxH : elbowY;

    // Clamp to screen
    const clampedBoxX = Math.max(margin, Math.min(canvasW - boxW - margin, boxX));
    const clampedBoxY = Math.max(margin, Math.min(canvasH - boxH - margin, boxY));

    // Leader line: object → elbow → box edge
    const lineEndX = dirX > 0 ? clampedBoxX : clampedBoxX + boxW;
    const lineEndY = clampedBoxY + boxH / 2;

    // Small dot at the object
    ctx.fillStyle = 'rgba(100, 180, 255, 0.8)';
    ctx.beginPath(); ctx.arc(objX, objY, 2, 0, Math.PI * 2); ctx.fill();

    // Leader line
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(objX, objY);
    ctx.lineTo(elbowX, elbowY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();

    // Small tick at the connection to the box
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(lineEndX, lineEndY - 4);
    ctx.lineTo(lineEndX, lineEndY + 4);
    ctx.stroke();

    // Label box
    ctx.fillStyle = 'rgba(8, 10, 18, 0.88)';
    ctx.strokeStyle = 'rgba(100, 180, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(clampedBoxX, clampedBoxY, boxW, boxH, 3); ctx.fill(); ctx.stroke();

    // Title
    ctx.font = '12px "DotGothic16", monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(title, clampedBoxX + 10, clampedBoxY + 16);

    // Info lines
    ctx.font = '11px "DotGothic16", monospace';
    ctx.fillStyle = 'rgba(100, 180, 255, 0.8)';
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], clampedBoxX + 10, clampedBoxY + 32 + i * 16);
    }
    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════
  // HUD + LEVEL TABS
  // ════════════════════════════════════════════════════

  _renderLevelTabs(ctx, w, h) {
    const tabH = 32;
    const tabY = h - tabH;
    const tabW = w / LEVELS.length;

    for (let i = 0; i < LEVELS.length; i++) {
      const active = i === this._levelIndex;
      const x = i * tabW;

      // Background
      ctx.fillStyle = active ? 'rgba(100, 180, 255, 0.15)' : 'rgba(20, 25, 35, 0.8)';
      ctx.fillRect(x, tabY, tabW, tabH);

      // Border
      ctx.strokeStyle = active ? 'rgba(100, 180, 255, 0.5)' : 'rgba(100, 180, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, tabY, tabW, tabH);

      // Label
      ctx.font = '11px "DotGothic16", monospace';
      ctx.fillStyle = active ? '#fff' : 'rgba(255,255,255,0.4)';
      ctx.textAlign = 'center';
      ctx.fillText(LEVEL_NAMES[i], x + tabW / 2, tabY + 20);
    }
    ctx.textAlign = 'left';
  }

  _renderHUD(ctx, w, h) {
    ctx.font = '14px "DotGothic16", monospace';

    // System name (top-left) — hide when system view draws its own header
    if (this._currentSystemName && this._levelIndex !== 4) {
      ctx.fillStyle = '#00ff80';
      ctx.fillText('CURRENT SYSTEM', 16, 24);
      ctx.font = '16px "DotGothic16", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(this._currentSystemName, 16, 44);
    }

    // Sector name
    if (this._currentSector && this._levelIndex !== 4) {
      ctx.font = '11px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
      ctx.fillText(this._currentSector.name, 16, 60);
    }

    // Autopilot toggle button (bottom-left, above tabs)
    {
      const tabH = 32;
      const btnText = this._autopilotActive ? '▶ AUTOPILOT ON' : '▷ AUTOPILOT OFF';
      const btnColor = this._autopilotActive ? '#00ff80' : 'rgba(255,255,255,0.35)';
      const btnW = 140, btnH = 24;
      const btnX = 8, btnY = h - tabH - btnH - 8;
      ctx.fillStyle = this._autopilotActive ? 'rgba(0, 255, 128, 0.08)' : 'rgba(255,255,255,0.03)';
      ctx.fillRect(btnX, btnY, btnW, btnH);
      ctx.strokeStyle = btnColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(btnX, btnY, btnW, btnH);
      ctx.font = '10px "DotGothic16", monospace';
      ctx.fillStyle = btnColor;
      ctx.textAlign = 'left';
      ctx.fillText(btnText, btnX + 8, btnY + 16);
      this._autopilotButtonRect = { x: btnX, y: btnY, w: btnW, h: btnH };
    }

    // Level info (top-right)
    ctx.font = '12px "DotGothic16", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(LEVEL_NAMES[this._levelIndex], w - 16, 24);

    if (this._levelIndex === 3 && this._localStars.length > 0) {
      const est = this._estimatedBlockStars;
      const estLabel = est != null ? `~${est.toLocaleString()} SYSTEMS IN BLOCK` : '';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(estLabel, w - 16, 42);
      const radLy = (this._localRadius * 1000 * 3.26).toFixed(0);
      ctx.fillText(`VIEW: ${radLy} ly`, w - 16, 58);

      // HEIGHT display with galactic structure context
      const yKpc = this._localCenter.y;
      const absYKpc = Math.abs(yKpc);
      const yPc = (yKpc * 1000).toFixed(0);
      const aboveBelow = yKpc >= 0 ? 'above' : 'below';
      let region;
      if (absYKpc < 0.3) region = 'thin disk';
      else if (absYKpc < 1.0) region = 'thick disk';
      else region = 'halo';
      ctx.fillText(`HEIGHT: ${yPc} pc ${aboveBelow} plane (${region})`, w - 16, 74);

      // Player galactic Y in kpc and pc
      const playerYPc = (this._playerY * 1000).toFixed(0);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(`PLAYER Y: ${this._playerY.toFixed(3)} kpc (${playerYPc} pc)`, w - 16, 90);

      // Y range being queried
      const yCenter = this._playerY;
      const yHalf = 2.0;
      const yMinPc = ((yCenter - yHalf) * 1000).toFixed(0);
      const yMaxPc = ((yCenter + yHalf) * 1000).toFixed(0);
      ctx.fillText(`Y RANGE: ${yMinPc} to ${yMaxPc} pc`, w - 16, 106);
    }

    ctx.textAlign = 'left';
  }

  // ════════════════════════════════════════════════════
  // INPUT
  // ════════════════════════════════════════════════════

  _getCanvasPos(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this._canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this._canvas.height / rect.height),
    };
  }

  _handleMouseMove(e) {
    const p = this._getCanvasPos(e);
    this._mouseX = p.x;
    this._mouseY = p.y;

    // Dragging
    if (this._dragging) {
      if (this._levelIndex === 3) {
        // Column: orbit
        const dx = p.x - this._dragStartX;
        const dy = p.y - this._dragStartY;
        this._localRotY = this._dragStartRotY + dx * 0.008;
        this._localRotX = Math.max(0, Math.min(Math.PI / 2, this._dragStartRotX - dy * 0.008));
      } else if (this._levelIndex === 4) {
        // System view: orbit
        const dx = p.x - this._dragStartX;
        const dy = p.y - this._dragStartY;
        this._systemRotY = this._dragStartRotY + dx * 0.008;
        this._systemRotX = Math.max(0.1, Math.min(Math.PI / 2, this._dragStartRotX - dy * 0.008));
      } else {
        // 2D: pan
        if (this._panStartCenter) {
          const drawSize = Math.min(this._canvas.width, this._canvas.height) - 80;
          const scale = this._viewSize / drawSize;
          const dx = (p.x - this._dragStartX) * scale;
          const dy = (p.y - this._dragStartY) * scale;
          this._viewCenter.x = this._panStartCenter.x - dx;
          this._viewCenter.z = this._panStartCenter.z + dy;
          this._densityCacheKey = ''; // invalidate
        }
      }
      return;
    }

    // Hover detection for 2D levels
    if (this._levelIndex > 0 && this._levelIndex <= 2) {
      const drawSize = Math.min(this._canvas.width, this._canvas.height) - 80;
      const ox = (this._canvas.width - drawSize) / 2;
      const oy = 10;
      const gn = gridNForLevel(this._levelIndex);
      const tileW = drawSize / gn;
      const col = Math.floor((p.x - ox) / tileW);
      const row = Math.floor((p.y - oy) / tileW);
      if (col >= 0 && col < gn && row >= 0 && row < gn) {
        this._hoveredTile = { col, row };
      } else {
        this._hoveredTile = null;
      }
    } else if (this._levelIndex === 0) {
      // Galaxy level — hover handled in renderSectorOverlay
      this._hoveredTile = null;
    }
  }

  _handleMouseDown(e) {
    const p = this._getCanvasPos(e);
    this._dragging = true;
    this._dragStartX = p.x;
    this._dragStartY = p.y;

    if (this._levelIndex === 3) {
      this._dragStartRotX = this._localRotX;
      this._dragStartRotY = this._localRotY;
    } else if (this._levelIndex === 4) {
      this._dragStartRotX = this._systemRotX;
      this._dragStartRotY = this._systemRotY;
    } else {
      this._panStartCenter = { ...this._viewCenter };
    }
  }

  _handleMouseUp() {
    this._dragging = false;
    this._panStartCenter = null;
  }

  _handleClick(e) {
    if (this._anim) return; // suppress clicks during drill animation
    const p = this._getCanvasPos(e);

    // Check autopilot button click
    if (this._autopilotButtonRect) {
      const r = this._autopilotButtonRect;
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        if (this._onAutopilotToggle) this._onAutopilotToggle(!this._autopilotActive);
        return;
      }
    }

    // Check tab clicks
    const tabH = 32;
    const tabY = this._canvas.height - tabH;
    if (p.y >= tabY) {
      const tabW = this._canvas.width / LEVELS.length;
      const idx = Math.floor(p.x / tabW);
      if (idx >= 0 && idx < LEVELS.length) {
        const target = this._viewStack[idx];
        // Animate between 2D levels if both are 2D and have stack entries
        if (idx <= 2 && this._levelIndex <= 2 && target) {
          if (this._onDrillSound) this._onDrillSound(idx);
          this._startDrillAnim(
            { x: this._viewCenter.x, z: this._viewCenter.z }, this._viewSize,
            { x: target.center.x, z: target.center.z }, target.size,
            idx, 350
          );
        } else {
          // System tab — if no star selected, auto-select the nearest star to the player
          if (idx === 4 && !this._systemData) {
            const nearest = this._findNearestStar();
            if (!nearest) return;
            this._systemStar = nearest;
            this._selectedNavStar = nearest;
            this._externalTarget = { x: nearest.wx, y: nearest.wy, z: nearest.wz, name: nearest.name || '' };
            // Use actual system data if returning to current system
            this._systemData = (this._isCurrentSystem() && this._currentSystemData)
              ? this._currentSystemData : null;
            this._hoveredBody = null;
            this._systemMode = 'system';
            this._systemZoom = 1.0;
            this._clearCommitSelection();
          }
          if (this._onDrillSound) this._onDrillSound(idx);
          this._levelIndex = idx;
          this._applyLevelView();
          this._densityCacheKey = '';
        }
        this._hoveredTile = null;
        if (idx !== 3 && idx !== 4) {
          this._localStars = [];
          this._resetColumnLoad();
        }
      }
      return;
    }

    // Right-click = go back
    if (e.button === 2) {
      this.handleEscape();
      return;
    }

    // Don't handle clicks during drag (mouse moved)
    const dx = p.x - this._dragStartX;
    const dy = p.y - this._dragStartY;
    if (dx * dx + dy * dy > 25) return; // was a drag, not a click

    // System view — click body or COMMIT button
    if (this._levelIndex === 4) {
      const isCurrent = this._isCurrentSystem();

      // Check COMMIT button click first
      if (this._commitButtonRect && this._commitAction) {
        const r = this._commitButtonRect;
        if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
          if (this._onSound) this._onSound(isCurrent ? 'warpLockOn' : 'warpTarget');
          if (this._onCommit) this._onCommit(this._commitAction);
          return;
        }
      }

      if (this._systemMode === 'planet') {
        if (isCurrent) {
          // Current system planet detail: click moon or planet to select as burn target
          if (this._hoveredBody && this._hoveredBody.type === 'moon') {
            if (this._onSound) this._onSound('select');
            this._selectedBody = { type: 'moon', planetIndex: this._selectedPlanetIdx, moonIndex: this._hoveredBody.index };
            this._commitAction = this._buildCommitAction();
            return;
          }
          if (this._hoveredBody && this._hoveredBody.type === 'planet') {
            if (this._onSound) this._onSound('select');
            this._selectedBody = { type: 'planet', planetIndex: this._selectedPlanetIdx };
            this._commitAction = this._buildCommitAction();
            return;
          }
          // Click empty — clear selection, return to system view
          this._clearCommitSelection();
          this._systemMode = 'system';
          return;
        } else {
          // Foreign system planet detail: click returns to system (info only)
          this._systemMode = 'system';
          return;
        }
      }

      // System mode
      if (this._hoveredBody && this._hoveredBody.type === 'star') {
        if (this._onSound) this._onSound('select');
        this._selectedBody = { type: 'star', starIndex: this._hoveredBody.index || 0 };
        this._commitAction = this._buildCommitAction();
        if (!isCurrent) {
          this._selectedNavStar = this._systemStar;
        }
        return;
      }
      if (this._hoveredBody && this._hoveredBody.type === 'planet') {
        if (this._onSound) this._onSound('select');
        const pIdx = this._hoveredBody.index;
        const hasMoons = this._systemData?.planets?.[pIdx]?.moons?.length > 0;

        if (isCurrent) {
          this._selectedBody = { type: 'planet', planetIndex: pIdx };
          this._commitAction = this._buildCommitAction();
          // Only drill into detail if the planet has moons to explore
          if (hasMoons) {
            this._selectedPlanetIdx = pIdx;
            this._systemMode = 'planet';
          }
        } else {
          // Foreign system: always drill for info
          this._selectedPlanetIdx = pIdx;
          this._systemMode = 'planet';
        }
        return;
      }
      // Click empty space — clear selection
      this._clearCommitSelection();
      return;
    }

    // Column level — click a star to enter system view with zoom animation
    if (this._levelIndex === 3 && this._hoveredLocalStar) {
      const star = this._hoveredLocalStar.star;
      console.log('[NAV] Entering system view for:', star.name, 'seed:', star.seed, 'type:', star.spectral);
      if (this._onDrillSound) this._onDrillSound(4);
      this._systemStar = star;
      this._selectedNavStar = star;
      // Update external target so trajectory line shows in 2D views
      this._externalTarget = { x: star.wx, y: star.wy, z: star.wz, name: star.name || '' };
      this._systemData = null; // will be generated in _renderSystem
      this._hoveredBody = null;
      this._systemMode = 'system';
      this._systemZoom = 1.0; // reset zoom for new system
      this._clearCommitSelection();
      // Zoom animation: shrink column view radius toward the star, then switch
      this._systemZoomAnim = {
        startTime: performance.now(),
        duration: 400,
        fromRadius: this._localRadius,
        toRadius: this._localRadius * 0.1,
        starPos: { x: star.wx, y: star.wy, z: star.wz },
        fromCenter: { ...this._localCenter },
      };
      return;
    }

    // Galaxy level — click a sector
    if (this._levelIndex === 0 && this._hoveredTile && this._hoveredTile.sector) {
      const s = this._hoveredTile.sector;
      this._viewStack[1] = {
        center: { x: s.centerX, z: s.centerZ },
        size: s.size,
        sectorName: s.name,
      };
      if (this._onDrillSound) this._onDrillSound(1);
      this._startDrillAnim(
        { x: this._viewCenter.x, z: this._viewCenter.z }, this._viewSize,
        { x: s.centerX, z: s.centerZ }, s.size,
        1, 500
      );
      this._hoveredTile = null;
      return;
    }

    // Sector/Region — click a tile to drill down
    if (this._levelIndex >= 1 && this._levelIndex <= 2 && this._hoveredTile && this._hoveredTile.col !== undefined) {
      const { col, row } = this._hoveredTile;
      const gn = gridNForLevel(this._levelIndex);
      const tileSize = this._viewSize / gn;
      const ext = this._viewSize / 2;
      const newCx = this._viewCenter.x - ext + (col + 0.5) * tileSize;
      const newCz = this._viewCenter.z + ext - (row + 0.5) * tileSize;

      if (this._levelIndex === 1) {
        // Sector → Region — zoom into the clicked tile
        const nextSize = tileSize; // the region view subdivides this tile into 16×16
        this._viewStack[2] = {
          center: { x: newCx, z: newCz },
          size: nextSize,
        };
        if (this._onDrillSound) this._onDrillSound(2);
        this._startDrillAnim(
          { x: this._viewCenter.x, z: this._viewCenter.z }, this._viewSize,
          { x: newCx, z: newCz }, nextSize,
          2, 400
        );
        this._hoveredTile = null;
      } else {
        // Region (level 2) → Column (level 3) — zoom into tile then switch
        this._localCenter = { x: newCx, y: this._playerY, z: newCz };
        // Update viewStack so orbit center matches the tile center
        this._viewStack[2] = { center: { x: newCx, z: newCz }, size: tileSize };
        this._localCubeSize = Math.max(0.003, this._computeTileSize(newCx, newCz, 150));
        // Default zoom: ~5 light years (5 ly ≈ 1.53 pc ≈ 0.00153 kpc)
        this._localRadius = 0.0015;
        this._localGridCell = 0.001;
        this._localStars = [];
        this._resetColumnLoad();
        // Start column view top-down, then tilt to default angle
        this._localRotX = Math.PI / 2; // top-down (matches 2D view)
        this._tiltAnim = { startTime: null, duration: 600, from: Math.PI / 2, to: 0.5 };
        // Animate zoom into the tile, then switch to column at completion
        const localSize = tileSize * 0.5;
        if (this._onDrillSound) this._onDrillSound(3);
        this._startDrillAnim(
          { x: this._viewCenter.x, z: this._viewCenter.z }, this._viewSize,
          { x: newCx, z: newCz }, localSize,
          3, 500
        );
        this._hoveredTile = null;
      }
      return;
    }
  }

  _handleWheel(e) {
    e.preventDefault();
    if (this._levelIndex === 3) {
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      this._localRadius = Math.max(0.002, Math.min(this._localCubeSize || 0.01, this._localRadius * factor));
    } else if (this._levelIndex === 4) {
      const factor = e.deltaY > 0 ? 0.87 : 1.15;
      this._systemZoom = Math.max(0.3, Math.min(5.0, this._systemZoom * factor));
    }
  }
}
