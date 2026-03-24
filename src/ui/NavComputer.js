import { generateSystemName } from '../generation/NameGenerator.js';
import { HashGridStarfield } from '../generation/HashGridStarfield.js';
import { GalacticSectors } from '../generation/GalacticSectors.js';
import { GalaxyLuminosityRenderer } from '../rendering/GalaxyLuminosityRenderer.js';
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

const LEVELS = ['galaxy', 'sector', 'district', 'block', 'local'];
const LEVEL_NAMES = ['GALAXY', 'SECTOR', 'DISTRICT', 'BLOCK', 'LOCAL'];
const GRID_N = 8; // tiles per axis at each 2D level

export class NavComputer {
  constructor(canvas, galacticMap) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._gm = galacticMap;

    // Sectors (persistent, named)
    this._sectors = new GalacticSectors(galacticMap, 'well-dipper-galaxy-1');

    // Current level
    this._levelIndex = 4; // start at LOCAL

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
    this._selectedNavStar = null;   // star selected BY user in local view { wx, wy, wz, seed, name }
    this._externalTarget = null;    // warp target SET from outside { x, y, z } in galactic kpc

    // ── Mouse ──
    this._mouseX = 0;
    this._mouseY = 0;
    this._dragging = false;
    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragStartRotX = 0;
    this._dragStartRotY = 0;
    this._panStartCenter = null;

    // ── Galaxy luminosity renderer (per-view images driven by Layer 0) ──
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
      if (e.code === 'Backquote' && this._levelIndex === 4) {
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
    };
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

  setPlayerPosition(galacticPos) {
    this._playerX = galacticPos.x;
    this._playerY = galacticPos.y || 0;
    this._playerZ = galacticPos.z;
    console.log(`[NAV] setPlayerPosition: Y=${galacticPos.y?.toFixed(4) || '0'} → _playerY=${this._playerY.toFixed(4)}`);
    this._currentSector = this._sectors.getSectorAt({ x: this._playerX, z: this._playerZ });

    // Center local view on player's actual 3D position (including height above plane)
    this._localCenter = { x: this._playerX, y: this._playerY, z: this._playerZ };
    // Cube size based on local density
    this._localCubeSize = Math.max(0.003, this._computeTileSize(this._playerX, this._playerZ, 500));
    this._localRadius = Math.min(this._localCubeSize, this._localCubeSize / 3);
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

    // District and block — adaptive sizing centered on player
    const districtSize = this._computeTileSize(this._playerX, this._playerZ, 10000) * GRID_N;
    this._viewStack.push({
      center: { x: this._playerX, z: this._playerZ },
      size: districtSize,
    });

    const blockSize = this._computeTileSize(this._playerX, this._playerZ, 1000) * GRID_N;
    this._viewStack.push({
      center: { x: this._playerX, z: this._playerZ },
      size: blockSize,
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

  render() {
    this._resizeCanvas();
    const ctx = this._ctx;
    const w = this._canvas.width;
    const h = this._canvas.height;

    // WASD panning in local view
    if (this._levelIndex === 4 && this._heldKeys.size > 0) {
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
        const blockCenter = this._viewStack[3]?.center;
        if (blockCenter && this._localCubeSize) {
          const half = this._localCubeSize;
          this._localCenter.x = Math.max(blockCenter.x - half, Math.min(blockCenter.x + half, this._localCenter.x));
          this._localCenter.z = Math.max(blockCenter.z - half, Math.min(blockCenter.z + half, this._localCenter.z));
        }
        // Don't re-query stars — we have the full block cached
      }
    }

    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, w, h);

    const level = LEVELS[this._levelIndex];
    if (level === 'local') {
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
    if (this._levelIndex > 0) {
      this._levelIndex--;
      this._applyLevelView();
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
  // 2D LEVEL RENDERING (Galaxy, Sector, District, Block)
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
      // Grid tiles
      const tileW = drawSize / GRID_N;
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.12)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_N; i++) {
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
        const tileSize = viewSize / GRID_N;
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
    // Quantize key to avoid re-rendering for tiny view shifts
    const qcx = Math.round(cx * 10) / 10;
    const qcz = Math.round(cz * 10) / 10;
    const qext = Math.round(ext * 100) / 100;
    const key = `${qcx},${qcz},${qext}`;

    if (this._mapCache.has(key)) {
      const entry = this._mapCache.get(key);
      entry.lastUsed = Date.now();
      return entry.canvas;
    }

    // Scale-dependent post-processing options
    console.log('NavComputer: rendering luminosity map at (' + cx.toFixed(1) + ',' + cz.toFixed(1) + ') ext=' + ext.toFixed(2) + ' key=' + key);
    const t0 = performance.now();
    // Scale-dependent lighting: at full galaxy view, use defaults.
    // At sector/district zoom, boost arms and disk so local detail is visible.
    const compOverrides = {};
    if (ext < 10) {
      // Zoomed in — boost faint components so local structure is visible
      compOverrides.arms = { gain: 5.0, stretch: 800 };
      compOverrides.disk = { gain: 4.0, stretch: 600 };
    }
    if (ext < 2) {
      // Deep zoom — maximize local contrast
      compOverrides.arms = { gain: 8.0, stretch: 1200 };
      compOverrides.disk = { gain: 6.0, stretch: 1000 };
      compOverrides.core = { gain: 0.5 };  // dim core to avoid washing out local detail
    }
    const canvas = this._luminosityRenderer.render(cx, cz, ext, this._mapRes, {
      dustStrength: ext > 10 ? 0.5 : ext > 2 ? 0.3 : 0.1,
      noiseStrength: ext > 10 ? 0.4 : ext > 2 ? 0.6 : 0.8,
      components: compOverrides,
    });

    console.log('NavComputer: rendered in', (performance.now() - t0).toFixed(0), 'ms');
    this._mapCache.set(key, { canvas, lastUsed: Date.now() });

    // Evict oldest if over limit
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
    const blockCenter = this._viewStack[3]?.center || { x: cx, z: cz };
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
      ctx.fillStyle = star.color;
      ctx.beginPath(); ctx.arc(starP.x, starP.y, isSelected ? baseRadius + 1 : baseRadius, 0, Math.PI * 2); ctx.fill();

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
      this._drawTooltip(ctx, sx, sy, star.name || 'Unnamed', [
        `${star.spectral} class`,
        `${star.distPc} pc (${(star.dist * 1000 * 3.26).toFixed(1)} ly)`,
        `${((star.wy - planeY) * 1000).toFixed(0)} pc ${star.wy >= planeY ? 'above' : 'below'} plane`,
      ]);
      ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(sx, sy, 8, 0, Math.PI * 2); ctx.stroke();
    }

    // Unified column minimap
    this._renderColumnMinimap(ctx, w, drawH);
  }

  _renderColumnMinimap(ctx, w, h) {
    const cubeHalf = this._localCubeSize || 0.01;
    const blockCenter = this._viewStack[3]?.center || this._localCenter;

    // Find Y extent of all stars
    let minStarY = 0, maxStarY = 0;
    for (const s of this._localStars) {
      if (s.wy < minStarY) minStarY = s.wy;
      if (s.wy > maxStarY) maxStarY = s.wy;
    }
    const yRange = Math.max(0.001, maxStarY - minStarY);

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
    const viewH = Math.max(4, (this._localRadius * 4 / yRange) * ySize);

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
    const blockCenter = this._viewStack[3]?.center || { x: cx, z: cz };
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
        try { name = generateSystemName(this._makeRng(s.seed)); } catch {}
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

    // System name (top-left)
    if (this._currentSystemName) {
      ctx.fillStyle = '#00ff80';
      ctx.fillText('CURRENT SYSTEM', 16, 24);
      ctx.font = '16px "DotGothic16", monospace';
      ctx.fillStyle = '#fff';
      ctx.fillText(this._currentSystemName, 16, 44);
    }

    // Sector name
    if (this._currentSector) {
      ctx.font = '11px "DotGothic16", monospace';
      ctx.fillStyle = 'rgba(100, 180, 255, 0.6)';
      ctx.fillText(this._currentSector.name, 16, 60);
    }

    // Level info (top-right)
    ctx.font = '12px "DotGothic16", monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(LEVEL_NAMES[this._levelIndex], w - 16, 24);

    if (this._levelIndex === 4 && this._localStars.length > 0) {
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
      if (this._levelIndex === 4) {
        // Local: orbit
        const dx = p.x - this._dragStartX;
        const dy = p.y - this._dragStartY;
        this._localRotY = this._dragStartRotY + dx * 0.008;
        // Clamp vertical tilt: 0 = edge-on, π/2 = top-down. Never underneath.
        this._localRotX = Math.max(0, Math.min(Math.PI / 2, this._dragStartRotX - dy * 0.008));
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
    if (this._levelIndex < 4 && this._levelIndex > 0) {
      const drawSize = Math.min(this._canvas.width, this._canvas.height) - 80;
      const ox = (this._canvas.width - drawSize) / 2;
      const oy = 10;
      const tileW = drawSize / GRID_N;
      const col = Math.floor((p.x - ox) / tileW);
      const row = Math.floor((p.y - oy) / tileW);
      if (col >= 0 && col < GRID_N && row >= 0 && row < GRID_N) {
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

    if (this._levelIndex === 4) {
      this._dragStartRotX = this._localRotX;
      this._dragStartRotY = this._localRotY;
    } else {
      this._panStartCenter = { ...this._viewCenter };
    }
  }

  _handleMouseUp() {
    this._dragging = false;
    this._panStartCenter = null;
  }

  _handleClick(e) {
    const p = this._getCanvasPos(e);

    // Check tab clicks
    const tabH = 32;
    const tabY = this._canvas.height - tabH;
    if (p.y >= tabY) {
      const tabW = this._canvas.width / LEVELS.length;
      const idx = Math.floor(p.x / tabW);
      if (idx >= 0 && idx < LEVELS.length) {
        this._levelIndex = idx;
        this._applyLevelView();
        this._hoveredTile = null;
        this._localStars = [];
        this._resetColumnLoad();
        this._densityCacheKey = '';
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

    // Local level — click a star to select it as nav target
    if (this._levelIndex === 4 && this._hoveredLocalStar) {
      const star = this._hoveredLocalStar.star;
      if (this._selectedNavStar === star) {
        // Click same star again → deselect
        this._selectedNavStar = null;
      } else {
        this._selectedNavStar = star;
      }
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
      this._levelIndex = 1;
      this._applyLevelView();
      this._hoveredTile = null;
      this._densityCacheKey = '';
      return;
    }

    // Other 2D levels — click a tile to drill down
    if (this._levelIndex >= 1 && this._levelIndex <= 3 && this._hoveredTile && this._hoveredTile.col !== undefined) {
      const { col, row } = this._hoveredTile;
      const tileSize = this._viewSize / GRID_N;
      const ext = this._viewSize / 2;
      const newCx = this._viewCenter.x - ext + (col + 0.5) * tileSize;
      const newCz = this._viewCenter.z + ext - (row + 0.5) * tileSize;

      if (this._levelIndex < 3) {
        // Drill into next 2D level
        const nextSize = tileSize;
        this._viewStack[this._levelIndex + 1] = {
          center: { x: newCx, z: newCz },
          size: nextSize,
        };
        this._levelIndex++;
        this._applyLevelView();
        this._hoveredTile = null;
        this._densityCacheKey = '';
      } else {
        // Level 3 (block) → Level 4 (local)
        this._localCenter = { x: newCx, y: this._playerY, z: newCz };
        // Cube size from local density at target position (same formula as player's block)
        this._localCubeSize = Math.max(0.003, this._computeTileSize(newCx, newCz, 500));
        // Default zoom = 1/3 of cube (readable density)
        this._localRadius = Math.max(0.002, this._localCubeSize / 3);
        this._localGridCell = 0.001; // 1 pc fixed cell size
        this._localStars = [];
        this._resetColumnLoad();
        this._levelIndex = 4;
        this._hoveredTile = null;
      }
      return;
    }
  }

  _handleWheel(e) {
    e.preventDefault();
    if (this._levelIndex === 4) {
      const factor = e.deltaY > 0 ? 1.15 : 0.87;
      // Min: 2 pc, Max: matches the cube size (no empty space beyond)
      this._localRadius = Math.max(0.002, Math.min(this._localCubeSize || 0.01, this._localRadius * factor));
      // Don't clear _localStars — the column data is still valid, just the view scale changed
    }
  }
}
