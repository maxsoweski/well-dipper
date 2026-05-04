/**
 * AutopilotNavSequence — Scripts varied nav computer interactions for autopilot warps.
 *
 * Instead of always doing the same full drill-down, the sequence randomly picks
 * a NAVIGATION STYLE that determines how the nav computer is used:
 *
 *   "full_journey"  — Galaxy → Sector → Region → Column → Star (the grand tour)
 *   "sector_hop"    — Sector → Region → Column → Star (skip galaxy, faster)
 *   "column_scroll" — Column view, scroll Y axis up/down, then pick a star
 *   "nearby_pick"   — Stay in current column, just pick a different star quickly
 *   "region_browse"  — Region → Column → Star (mid-level zoom)
 *
 * This creates visual diversity in the screensaver — sometimes we see the full
 * galaxy, sometimes we just scroll through local stars, sometimes we hop sectors.
 */

import { simClockMs } from '../core/SimClock.js';

// ── Navigation styles with weights ──
// Higher weight = more likely to be picked. Weighted random, not rotation.
const NAV_STYLES = [
  { name: 'full_journey',  weight: 3 },  // grand tour through all levels
  { name: 'sector_hop',    weight: 2 },  // skip galaxy, start at sector
  { name: 'column_scroll', weight: 3 },  // scroll through column, pick star
  { name: 'nearby_pick',   weight: 2 },  // quick pick from current column
  { name: 'region_browse', weight: 2 },  // sector → region → column
];
const TOTAL_WEIGHT = NAV_STYLES.reduce((s, ns) => s + ns.weight, 0);

// ── Destination strategies (rotated for galactic diversity) ──
const DEST_STRATEGIES = [
  'arm', 'arm', 'arm', 'core', 'rim', 'vertical', 'opposite',
];

export class AutopilotNavSequence {
  constructor(opts) {
    this._nav = opts.navComputer;
    this._gm = opts.galacticMap;
    this._openNav = opts.openNavComputer;
    this._closeNav = opts.closeNavComputer;
    this._onWarpReady = opts.onWarpReady;
    this._onComplete = opts.onComplete;
    this._soundEngine = opts.soundEngine;
    this._playerPos = opts.playerPos || { x: 8, y: 0, z: 0 };
    this._active = false;
    this._aborted = false;
    this._timers = [];
    this._scrollInterval = null;
    this._recentDests = [];
    this._strategyIndex = -1;
    this._armIndex = -1;
    this._lastStyle = null; // avoid repeating same style twice
  }

  get isActive() { return this._active; }

  start() {
    if (this._active) return;
    this._active = true;
    this._aborted = false;

    // Pick navigation style (weighted random, avoid repeating)
    const style = this._pickStyle();
    this._lastStyle = style;

    // For nearby_pick and column_scroll, we can use a destination near the player
    // For others, pick a diverse galactic destination
    const needsFarDest = (style === 'full_journey' || style === 'sector_hop' || style === 'region_browse');
    const dest = needsFarDest ? this._pickDestination() : this._pickNearbyDestination();

    if (!dest) {
      console.warn('[NAV-SEQ] No destination found, aborting');
      this._finish();
      return;
    }

    console.log(`[NAV-SEQ] Style: ${style} | Destination: ${dest.label} (${dest.x.toFixed(1)}, ${dest.z.toFixed(1)}) | needsFar=${needsFarDest}`);

    this._openNav();
    console.log(`[NAV-SEQ] Nav opened, levelIndex=${this._nav._levelIndex}`);

    this._delay(300, () => {
      if (this._aborted) return;
      this._runStyle(style, dest);
    });
  }

  abort() {
    if (!this._active) return;
    this._aborted = true;
    this._clearTimers();
    this._finish();
  }

  // ── Style dispatch ──

  _runStyle(style, dest) {
    switch (style) {
      case 'full_journey':
        this._startAtGalaxy(dest);
        break;
      case 'sector_hop':
        this._startAtSector(dest);
        break;
      case 'region_browse':
        this._startAtRegion(dest);
        break;
      case 'column_scroll':
        this._startColumnScroll(dest);
        break;
      case 'nearby_pick':
        this._startNearbyPick(dest);
        break;
      default:
        this._startAtGalaxy(dest);
    }
  }

  // ── Style: Full Journey (Galaxy → Sector → Region → Column → Star) ──

  _startAtGalaxy(dest) {
    this._nav._levelIndex = 0;
    this._nav._viewCenter = { x: 0, z: 0 };
    this._nav._viewSize = 44;
    this._nav._viewStack = [];
    this._nav._hoveredTile = null;
    this._nav._localStars = [];
    this._nav._resetColumnLoad();
    if (this._soundEngine) this._soundEngine.play('navDrill0');

    // Pause at galaxy (2-3s)
    this._delay(2000 + Math.random() * 1000, () => this._drillToSector(dest));
  }

  // ── Style: Sector Hop (skip galaxy, start at sector level) ──

  _startAtSector(dest) {
    const sector = this._sectorForDest(dest);
    this._nav._levelIndex = 1;
    this._nav._viewCenter = { x: sector.cx, z: sector.cz };
    this._nav._viewSize = sector.size;
    this._nav._viewStack = [undefined, { center: { x: sector.cx, z: sector.cz }, size: sector.size }];
    this._nav._hoveredTile = null;
    this._nav._localStars = [];
    this._nav._resetColumnLoad();
    if (this._soundEngine) this._soundEngine.play('navDrill1');

    // Pause at sector (1.5-2.5s), then hover+drill to region
    this._delay(1500 + Math.random() * 1000, () => this._hoverThenDrillRegion(dest, sector.cx, sector.cz, sector.size));
  }

  // ── Style: Region Browse (start at region level) ──

  _startAtRegion(dest) {
    const sector = this._sectorForDest(dest);
    const region = this._regionForDest(dest, sector.cx, sector.cz, sector.size);

    this._nav._levelIndex = 2;
    this._nav._viewCenter = { x: region.cx, z: region.cz };
    this._nav._viewSize = region.size;
    this._nav._viewStack = [
      undefined,
      { center: { x: sector.cx, z: sector.cz }, size: sector.size },
      { center: { x: region.cx, z: region.cz }, size: region.size },
    ];
    this._nav._hoveredTile = null;
    this._nav._localStars = [];
    this._nav._resetColumnLoad();
    if (this._soundEngine) this._soundEngine.play('navDrill2');

    // Pause at region (1.5-2s), then hover+drill to column
    this._delay(1500 + Math.random() * 500, () => this._hoverThenDrillColumn(dest, region.cx, region.cz, region.size));
  }

  // ── Style: Column Scroll (open column, scroll Y, pick star) ──

  _startColumnScroll(dest) {
    // Jump straight to column view at destination
    this._setupColumnView(dest);
    if (this._soundEngine) this._soundEngine.play('navDrill3');

    // Wait for stars to load
    this._delay(1500, () => {
      if (this._aborted) return;

      // Scroll Y axis for 3-5 seconds
      const scrollDuration = 3000 + Math.random() * 2000;
      const scrollDir = Math.random() > 0.5 ? 1 : -1; // up or down
      const scrollSpeed = (0.0002 + Math.random() * 0.0003) * scrollDir; // kpc per 50ms

      console.log(`[NAV-SEQ] Scrolling ${scrollDir > 0 ? 'up' : 'down'} for ${(scrollDuration / 1000).toFixed(1)}s`);

      this._scrollInterval = setInterval(() => {
        if (this._aborted) return;
        this._nav._localCenter.y += scrollSpeed;
        // Trigger star reloading by resetting the load state
        // The nav computer's render loop calls _ensureStarsLoaded which picks up the new Y
      }, 50);

      // After scrolling, stop and pick a star
      this._delay(scrollDuration, () => {
        if (this._scrollInterval) {
          clearInterval(this._scrollInterval);
          this._scrollInterval = null;
        }
        // Brief pause to let stars settle (1s)
        this._delay(1000, () => this._selectStar(dest));
      });
    });
  }

  // ── Style: Nearby Pick (quick pick from current neighborhood) ──

  _startNearbyPick(dest) {
    // Open directly to column view near current position
    this._setupColumnView(dest);
    if (this._soundEngine) this._soundEngine.play('navDrill3');

    // Short pause (1.5s) then pick
    this._delay(1500, () => this._selectStar(dest));
  }

  // ── Shared drill-down steps ──

  _drillToSector(dest) {
    if (this._aborted) return;
    const sector = this._sectorForDest(dest);

    // Simulate hover + cursor on the target sector
    const sectors = this._nav._sectors;
    if (sectors) {
      const match = sectors.getSectorAt?.({ x: dest.x, z: dest.z });
      if (match) {
        this._nav._hoveredTile = { sector: match };
        // Position cursor at sector center on canvas
        this._setCursorAtGalactic(dest.x, dest.z);
      }
    }

    // Hover + cursor visible for 800ms, then drill
    this._delay(800, () => {
      if (this._aborted) return;
      this._nav._viewStack[1] = { center: { x: sector.cx, z: sector.cz }, size: sector.size };
      this._nav._startDrillAnim(
        { x: this._nav._viewCenter.x, z: this._nav._viewCenter.z }, this._nav._viewSize,
        { x: sector.cx, z: sector.cz }, sector.size,
        1, 600
      );
      this._nav._hoveredTile = null;
      this._nav._autoCursor = null;
      if (this._soundEngine) this._soundEngine.play('navDrill1');

      // Pause at sector level (1.5-2.5s)
      this._delay(1500 + Math.random() * 1000, () => this._hoverThenDrillRegion(dest, sector.cx, sector.cz, sector.size));
    });
  }

  _hoverThenDrillRegion(dest, parentCx, parentCz, parentSize) {
    if (this._aborted) return;
    const region = this._regionForDest(dest, parentCx, parentCz, parentSize);

    // Simulate hover on the target tile (blue highlight)
    const gn = 16;
    const tileSize = parentSize / gn;
    const ext = parentSize / 2;
    const col = Math.max(0, Math.min(gn - 1, Math.floor((dest.x - (parentCx - ext)) / tileSize)));
    const row = Math.max(0, Math.min(gn - 1, Math.floor((dest.z - (parentCz - ext)) / tileSize)));
    this._nav._hoveredTile = { col, row };

    // Set cursor on the tile
    this._setCursorAtTile(col, row, gn, parentCx, parentCz, parentSize);

    // Hover + cursor visible for 700ms, then drill
    this._delay(700, () => {
      if (this._aborted) return;
      this._nav._viewStack[2] = { center: { x: region.cx, z: region.cz }, size: region.size };
      this._nav._startDrillAnim(
        { x: this._nav._viewCenter.x, z: this._nav._viewCenter.z }, this._nav._viewSize,
        { x: region.cx, z: region.cz }, region.size,
        2, 500
      );
      this._nav._hoveredTile = null;
      this._nav._autoCursor = null;
      if (this._soundEngine) this._soundEngine.play('navDrill2');

      // Pause at region (1.5-2s), then hover target tile and drill to column
      this._delay(1500 + Math.random() * 500, () => this._hoverThenDrillColumn(dest, region.cx, region.cz, region.size));
    });
  }

  _hoverThenDrillColumn(dest, regionCx, regionCz, regionSize) {
    if (this._aborted) return;

    // Simulate hover + cursor on the target tile in region view
    const gn = 16;
    const tileSize = regionSize / gn;
    const ext = regionSize / 2;
    const col = Math.max(0, Math.min(gn - 1, Math.floor((dest.x - (regionCx - ext)) / tileSize)));
    const row = Math.max(0, Math.min(gn - 1, Math.floor((dest.z - (regionCz - ext)) / tileSize)));
    this._nav._hoveredTile = { col, row };
    this._setCursorAtTile(col, row, gn, regionCx, regionCz, regionSize);

    // Hover + cursor visible for 700ms, then drill to column
    this._delay(700, () => {
      if (this._aborted) return;
      this._nav._hoveredTile = null;
      this._nav._autoCursor = null;

      console.log(`[NAV-SEQ] Drilling to column: dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) regionSize=${regionSize.toFixed(4)} currentLevel=${this._nav._levelIndex}`);

      this._nav._localCenter = { x: dest.x, y: dest.y || 0, z: dest.z };
      // Use adaptive cube sizing like the real nav (targets ~150 stars)
      // instead of raw regionSize which can be huge in dense areas
      this._nav._localCubeSize = Math.max(0.003, this._nav._computeTileSize?.(dest.x, dest.z, 150) || regionSize * 0.1);
      this._nav._localRadius = 0.0015;
      this._nav._localGridCell = 0.001;
      this._nav._localStars = [];
      this._nav._resetColumnLoad();

      // Tilt from top-down to angled (like entering 3D view)
      this._nav._localRotX = Math.PI / 2;
      this._nav._localRotY = 0;
      this._nav._tiltAnim = {
        startTime: simClockMs(),
        duration: 600,
        from: Math.PI / 2,
        to: 0.5,
      };

      const localSize = regionSize * 0.8;
      this._nav._startDrillAnim(
        { x: this._nav._viewCenter.x, z: this._nav._viewCenter.z }, this._nav._viewSize,
        { x: dest.x, z: dest.z }, localSize,
        3, 600
      );
      if (this._soundEngine) this._soundEngine.play('navDrill3');

      console.log(`[NAV-SEQ] Drill anim started → level 3, waiting for stars...`);
      // Wait for stars to load, then select
      this._delay(2000 + Math.random() * 500, () => this._selectStar(dest));
    });
  }

  /** Set up column view directly (no animation from 2D level) */
  _setupColumnView(dest) {
    const cubeSize = Math.max(0.003, this._nav._computeTileSize?.(dest.x, dest.z, 150) || 0.005);
    console.log(`[NAV-SEQ] _setupColumnView: dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) prevLevel=${this._nav._levelIndex} cubeSize=${cubeSize.toFixed(4)}`);
    this._nav._levelIndex = 3;
    this._nav._localCenter = { x: dest.x, y: dest.y || 0, z: dest.z };
    this._nav._localCubeSize = Math.max(0.003, this._nav._computeTileSize?.(dest.x, dest.z, 150) || 0.005);
    this._nav._localRadius = 0.0015;
    this._nav._localGridCell = 0.001;
    this._nav._localRotX = 0.5;
    this._nav._localRotY = 0;
    this._nav._localStars = [];
    this._nav._resetColumnLoad();

    // Set view state so the column renders properly
    // _viewStack[2] must have center matching the column position
    // (used by _ensureStarsLoaded for block center)
    this._nav._viewCenter = { x: dest.x, z: dest.z };
    this._nav._viewSize = 0.01;
    this._nav._viewStack = [
      undefined, undefined,
      { center: { x: dest.x, z: dest.z }, size: 0.01 },
    ];
  }

  // ── Star selection ──

  _selectStar(dest, retries = 0) {
    if (this._aborted) return;

    const stars = this._nav._localStars;
    const levelIdx = this._nav._levelIndex;
    const hasAnim = !!this._nav._anim;

    console.log(`[NAV-SEQ] _selectStar retry=${retries} stars=${stars?.length || 0} level=${levelIdx} anim=${hasAnim} dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) localCenter=(${this._nav._localCenter?.x?.toFixed(2)},${this._nav._localCenter?.z?.toFixed(2)}) viewStack[2]=${JSON.stringify(this._nav._viewStack?.[2]?.center)}`);

    // If still animating or not on column level, wait
    if ((hasAnim || levelIdx !== 3) && retries < 20) {
      this._delay(300, () => this._selectStar(dest, retries + 1));
      return;
    }

    if ((!stars || stars.length === 0) && retries < 20) {
      this._delay(300, () => this._selectStar(dest, retries + 1));
      return;
    }

    if (!stars || stars.length === 0) {
      console.warn(`[NAV-SEQ] No stars loaded after ${retries} retries — level=${levelIdx} anim=${hasAnim}. Aborting.`);
      this._nav._autoCursor = null;
      this._finish();
      return;
    }

    // Pick a star — prefer close to dest center, with some randomness
    const sorted = [...stars].sort((a, b) => {
      const da = (a.wx - dest.x) ** 2 + (a.wz - dest.z) ** 2;
      const db = (b.wx - dest.x) ** 2 + (b.wz - dest.z) ** 2;
      return da - db;
    });
    const pool = Math.min(8, sorted.length);
    const pick = sorted[Math.floor(Math.random() * pool)];

    console.log(`[NAV-SEQ] Selected star: ${pick.name} (${pick.spectral})`);

    this._nav._systemStar = pick;
    this._nav._selectedNavStar = pick;
    this._nav._externalTarget = { x: pick.wx, y: pick.wy, z: pick.wz, name: pick.name || '' };

    this._nav._systemZoomAnim = {
      startTime: simClockMs(),
      duration: 500,
      fromRadius: this._nav._localRadius,
      toRadius: this._nav._localRadius * 0.1,
      starPos: { x: pick.wx, y: pick.wy, z: pick.wz },
      fromCenter: { ...this._nav._localCenter },
    };
    if (this._soundEngine) this._soundEngine.play('navDrill4');

    // Pause at system view then warp
    this._delay(2000 + Math.random() * 500, () => this._initiateWarp(pick));
  }

  _initiateWarp(star) {
    if (this._aborted) return;

    console.log(`[NAV-SEQ] Initiating warp to ${star.name}`);

    this._nav._pendingAction = {
      type: 'warp',
      target: 'star',
      starIndex: 0,
      planetIndex: null,
      moonIndex: null,
      star: {
        wx: star.wx, wy: star.wy, wz: star.wz,
        seed: star.seed, name: star.name, spectral: star.spectral,
      },
    };

    if (this._onWarpReady) {
      this._onWarpReady({
        worldX: star.wx, worldY: star.wy, worldZ: star.wz,
        seed: star.seed, name: star.name, type: star.spectral,
      });
    }

    this._finish();
  }

  // ── Coordinate helpers ──

  _sectorForDest(dest) {
    const sectorCol = Math.max(0, Math.min(7, Math.floor(((dest.x + 22) / 44) * 8)));
    const sectorRow = Math.max(0, Math.min(7, Math.floor(((dest.z + 22) / 44) * 8)));
    const sectorSize = 44 / 8;
    return {
      cx: -22 + (sectorCol + 0.5) * sectorSize,
      cz: -22 + (sectorRow + 0.5) * sectorSize,
      size: sectorSize,
    };
  }

  _regionForDest(dest, parentCx, parentCz, parentSize) {
    const gn = 16;
    const tileSize = parentSize / gn;
    const ext = parentSize / 2;
    const col = Math.max(0, Math.min(gn - 1, Math.floor((dest.x - (parentCx - ext)) / tileSize)));
    const row = Math.max(0, Math.min(gn - 1, Math.floor((dest.z - (parentCz - ext)) / tileSize)));
    return {
      cx: parentCx - ext + (col + 0.5) * tileSize,
      cz: parentCz - ext + (row + 0.5) * tileSize,
      size: tileSize,
    };
  }

  // ── Style picker ──

  _pickStyle() {
    let roll = Math.random() * TOTAL_WEIGHT;
    for (const style of NAV_STYLES) {
      roll -= style.weight;
      if (roll <= 0) {
        // Avoid repeating the same style twice in a row
        if (style.name === this._lastStyle && NAV_STYLES.length > 1) {
          // Pick any other style
          const others = NAV_STYLES.filter(s => s.name !== this._lastStyle);
          return others[Math.floor(Math.random() * others.length)].name;
        }
        return style.name;
      }
    }
    return NAV_STYLES[0].name;
  }

  // ── Destination picking ──

  _pickDestination() {
    const px = this._playerPos.x || 8;
    const pz = this._playerPos.z || 0;

    this._strategyIndex = ((this._strategyIndex ?? -1) + 1) % DEST_STRATEGIES.length;
    const strategy = DEST_STRATEGIES[this._strategyIndex];

    let dest = null;
    let attempts = 0;

    while (!dest && attempts < 10) {
      attempts++;
      const candidate = this._generateCandidate(strategy, px, pz);
      if (!candidate) continue;

      const dx = candidate.x - px;
      const dz = candidate.z - pz;
      if (Math.sqrt(dx * dx + dz * dz) < 2.0) continue;

      const R = Math.sqrt(candidate.x * candidate.x + candidate.z * candidate.z);
      if (R > 14.5 || R < 0.3) continue;

      const tooClose = this._recentDests.some(rd => {
        const ddx = rd.x - candidate.x;
        const ddz = rd.z - candidate.z;
        return Math.sqrt(ddx * ddx + ddz * ddz) < 3.0;
      });
      if (tooClose && attempts < 8) continue;

      dest = candidate;
    }

    if (!dest) {
      const angle = Math.atan2(pz, px) + Math.PI;
      const R = 6 + Math.random() * 4;
      dest = { x: R * Math.cos(angle), z: R * Math.sin(angle), y: 0, label: 'Far Side' };
    }

    this._recentDests.push({ x: dest.x, z: dest.z });
    if (this._recentDests.length > 5) this._recentDests.shift();
    return dest;
  }

  /** Pick a destination near the current position (for column_scroll / nearby_pick) */
  _pickNearbyDestination() {
    const px = this._playerPos.x || 8;
    const pz = this._playerPos.z || 0;
    const py = this._playerPos.y || 0;
    // Nearby: within 0.5-2 kpc, random direction
    const angle = Math.random() * Math.PI * 2;
    const dist = 0.5 + Math.random() * 1.5;
    return {
      x: px + dist * Math.cos(angle),
      z: pz + dist * Math.sin(angle),
      y: py,
      label: 'Nearby',
    };
  }

  _generateCandidate(strategy, px, pz) {
    const gm = this._gm;
    if (!gm) return this._fallback(px, pz);

    switch (strategy) {
      case 'arm': {
        const arms = gm.arms || [];
        if (arms.length === 0) return this._fallback(px, pz);
        this._armIndex = ((this._armIndex ?? -1) + 1) % arms.length;
        const arm = arms[this._armIndex];
        const R = 2 + Math.random() * 11;
        const k = 1 / Math.tan(0.22);
        const theta = k * Math.log(R / 4.0) + arm.offset;
        const scatter = (Math.random() - 0.5) * 2.0;
        return {
          x: R * Math.cos(theta) + scatter * Math.sin(theta),
          z: R * Math.sin(theta) - scatter * Math.cos(theta),
          y: 0, label: arm.name,
        };
      }
      case 'core': {
        const a = Math.random() * Math.PI * 2;
        const R = 0.5 + Math.random() * 2.0;
        return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Galactic Core' };
      }
      case 'rim': {
        const a = Math.random() * Math.PI * 2;
        const R = 12 + Math.random() * 2;
        return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Galactic Rim' };
      }
      case 'vertical': {
        const a = Math.random() * Math.PI * 2;
        const R = 4 + Math.random() * 6;
        const y = (Math.random() > 0.5 ? 1 : -1) * (0.15 + Math.random() * 0.3);
        return { x: R * Math.cos(a), z: R * Math.sin(a), y, label: `${y > 0 ? 'Above' : 'Below'} the Disk` };
      }
      case 'opposite': {
        const a = Math.atan2(pz, px) + Math.PI + (Math.random() - 0.5) * 0.8;
        const R = Math.max(2, Math.min(13, Math.sqrt(px * px + pz * pz) + (Math.random() - 0.5) * 6));
        return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Far Side' };
      }
      default: return this._fallback(px, pz);
    }
  }

  _fallback(px, pz) {
    const a = Math.random() * Math.PI * 2;
    const R = 3 + Math.random() * 8;
    return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Deep Space' };
  }

  // ── Cursor positioning helpers ──

  /** Set blinking cursor at a galactic position (for galaxy view) */
  _setCursorAtGalactic(gx, gz) {
    const canvas = this._nav._canvas;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const drawH = h - 50; // tab bar height
    const size = Math.min(w, drawH) * 0.85;
    const ox = (w - size) / 2;
    const oy = (drawH - size) / 2;
    // Galaxy coords: -22 to +22 kpc mapped to canvas
    const px = ox + ((gx + 22) / 44) * size;
    const py = oy + ((-gz + 22) / 44) * size;
    this._nav._autoCursor = { x: px, y: py };
  }

  /** Set blinking cursor at a tile position (for sector/region views) */
  _setCursorAtTile(col, row, gridN, viewCx, viewCz, viewSize) {
    const canvas = this._nav._canvas;
    if (!canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const drawH = h - 50;
    const size = Math.min(w, drawH) * 0.85;
    const ox = (w - size) / 2;
    const oy = (drawH - size) / 2;
    const tileW = size / gridN;
    const px = ox + (col + 0.5) * tileW;
    const py = oy + (row + 0.5) * tileW;
    this._nav._autoCursor = { x: px, y: py };
  }

  // ── Utilities ──

  _delay(ms, fn) {
    const id = setTimeout(() => {
      const idx = this._timers.indexOf(id);
      if (idx !== -1) this._timers.splice(idx, 1);
      if (!this._aborted) fn();
    }, ms);
    this._timers.push(id);
  }

  _clearTimers() {
    for (const id of this._timers) clearTimeout(id);
    this._timers = [];
    if (this._scrollInterval) {
      clearInterval(this._scrollInterval);
      this._scrollInterval = null;
    }
  }

  _finish() {
    this._clearTimers();
    this._active = false;
    if (this._onComplete) this._onComplete();
  }
}
