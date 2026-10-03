/**
 * AutopilotNavSequence — Scripts varied nav computer interactions for autopilot warps.
 *
 * Instead of always doing the same full drill-down, the sequence randomly picks
 * a NAVIGATION STYLE that determines how the nav computer is used:
 *
 *   "full_journey"  — Galaxy → Sector → Region → Prism → Star (the grand tour)
 *   "sector_hop"    — Sector → Region → Prism → Star (skip galaxy, faster)
 *   "prism_scroll" — Prism view, scroll Y axis up/down, then pick a star
 *   "nearby_pick"   — Stay in current prism, just pick a different star quickly
 *   "region_browse"  — Region → Prism → Star (mid-level zoom)
 *
 * This creates visual diversity in the screensaver — sometimes we see the full
 * galaxy, sometimes we just scroll through local stars, sometimes we hop sectors.
 */

import { simClockMs } from '../core/SimClock.js';
import { simRandom } from '../core/SimRandom.js';  import * as navGrid from '../ui/navGrid.js';  import * as navDrill from '../ui/navDrill.js';   // ⚠ appended, not a new line — this file is line-cited

// ── Navigation styles with weights ──
// Higher weight = more likely to be picked. Weighted random, not rotation.
const NAV_STYLES = [
  { name: 'full_journey',  weight: 3 },  // grand tour through all levels
  { name: 'sector_hop',    weight: 2 },  // skip galaxy, start at sector
  { name: 'prism_scroll', weight: 3 },  // scroll through prism, pick star
  { name: 'nearby_pick',   weight: 2 },  // quick pick from current prism
  { name: 'region_browse', weight: 2 },  // sector → region → prism
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

    // For nearby_pick and prism_scroll, we can use a destination near the player
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
      case 'prism_scroll':
        this._startPrismScroll(dest);
        break;
      case 'nearby_pick':
        this._startNearbyPick(dest);
        break;
      default:
        this._startAtGalaxy(dest);
    }
  }

  // ── Style: Full Journey (Galaxy → Sector → Region → Prism → Star) ──

  _startAtGalaxy(dest) {
    // naming-prism-segments AC-4 — the GALAXY screen's own frame (the 19 × 19 naming area), from the
    // same `navDrill.jumpTo` / `navGrid.viewForAddress` every other entry path uses.
    navDrill.jumpTo(this._nav, navGrid.GALAXY, null);
    if (this._soundEngine) this._soundEngine.play('navDrill0');

    // Pause at galaxy (2-3s)
    this._delay(2000 + simRandom() * 1000, () => this._hoverThenDrill(dest, navGrid.GALAXY));
  }

  // ── Style: Sector Hop (skip galaxy, start at sector level) ──

  _startAtSector(dest) {
    // naming-prism-segments AC-4 — straight onto the destination's own SECTOR (its exact 2 kpc
    // square, with its address on the view stack), not a cell of a private 8 × 8 / 44 kpc grid.
    navDrill.jumpTo(this._nav, navGrid.SECTOR, navGrid.parentAt(navGrid.SECTOR, dest.x, dest.z));
    if (this._soundEngine) this._soundEngine.play('navDrill1');

    // Pause at sector (1.5-2.5s), then hover+drill to region
    this._delay(1500 + simRandom() * 1000, () => this._hoverThenDrill(dest, navGrid.SECTOR));
  }

  // ── Style: Region Browse (start at region level) ──

  _startAtRegion(dest) {
    // The destination's own REGION (exact 125 pc square), the stack above it built the same way.
    navDrill.jumpTo(this._nav, navGrid.REGION, navGrid.parentAt(navGrid.REGION, dest.x, dest.z));
    if (this._soundEngine) this._soundEngine.play('navDrill2');

    // Pause at region (1.5-2s), then hover+drill to prism
    this._delay(1500 + simRandom() * 500, () => this._hoverThenDrill(dest, navGrid.REGION));
  }

  // ── Style: Prism Scroll (open prism, scroll Y, pick star) ──

  _startPrismScroll(dest) {
    // Jump straight to prism view at destination
    this._setupPrismView(dest);
    if (this._soundEngine) this._soundEngine.play('navDrill3');

    // Wait for stars to load
    this._delay(1500, () => {
      if (this._aborted) return;

      // Scroll Y axis for 3-5 seconds
      const scrollDuration = 3000 + simRandom() * 2000;
      const scrollDir = simRandom() > 0.5 ? 1 : -1; // up or down
      const scrollSpeed = (0.0002 + simRandom() * 0.0003) * scrollDir; // kpc per 50ms

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
    // Open directly to prism view near current position
    this._setupPrismView(dest);
    if (this._soundEngine) this._soundEngine.play('navDrill3');

    // Short pause (1.5s) then pick
    this._delay(1500, () => this._selectStar(dest));
  }

  // ── Shared drill-down steps ──

  /**
   * ⭐ naming-prism-segments AC-4 — ONE STEP OF THE DRILL, THROUGH THE PILOT'S OWN CELLS.
   *
   * The cell this step lights and clicks is `navGrid.drillPath(dest)[level].child` — the child of the
   * screen's parent that holds the destination — and the click is `navDrill.drillInto`, the function
   * `NavComputer._handleClick` calls for a pilot's click. So at every level the autopilot shows and
   * flies to exactly the cell a pilot drilling to the same place would, and REGION → PRISM opens the
   * same fixed 7.8125 pc column.
   * ⛔ IT USED TO CARRY ITS OWN GRID: an 8 × 8 split of a 44 kpc square for the sector
   * (`_sectorForDest`), 16 × 16 view-relative tiles for the region and the hover (`{ col, row }`), a
   * hover on a quadtree sector that was not the square it then flew to, and an adaptive density box
   * around the destination for PRISM. None of those matched what the screens draw.
   *
   * Timing is the shipped choreography: hover 800 ms at GALAXY / 700 ms below, then drill (600 /
   * 500 / 600 ms), then a pause on the new screen before the next step.
   */
  _hoverThenDrill(dest, level) {
    if (this._aborted) return;
    const step = navGrid.drillPath(dest.x, dest.z)?.[level];
    if (!step || !step.child) {
      console.warn(`[NAV-SEQ] No cell for dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) at level ${level}, aborting`);
      this._nav._autoCursor = null;
      this._finish();
      return;
    }

    // Simulate hover + cursor on the target cell (the pilot's highlight, on the pilot's grid).
    // ⭐ The highlight is held for the hover AND the zoom that follows (Astra phase-2 review, finding
    //    5): a pilot's click keeps its cell framed through the drill, and the autopilot's must too —
    //    it used to expire at the designs' 700 ms backstop, before the 800 ms GALAXY hover ended.
    const hoverMs = level === navGrid.GALAXY ? 800 : 700;
    const drillMs = level === navGrid.SECTOR ? 500 : 600;
    const tile = navDrill.showPick(this._nav, level, step.child, { holdMs: hoverMs + drillMs + 100 });
    this._setCursorAtGalactic(tile.center.x, tile.center.z);

    // Hover + cursor visible, then drill
    this._delay(hoverMs, () => {
      if (this._aborted) return;
      this._nav._autoCursor = null;
      if (level === navGrid.REGION) {
        console.log(`[NAV-SEQ] Drilling to prism: dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) column=${navGrid.addressKey(navGrid.childOf(level, step.child))} currentLevel=${this._nav._levelIndex}`);
      }
      // Tilt from top-down to angled (like entering 3D view) at REGION → PRISM; the camera starts on
      // the column's centre at the destination's height.
      navDrill.drillInto(this._nav, level, step.child, {
        duration: drillMs, sound: false,
        y: dest.y || 0, tiltTo: 0.5, tiltStart: simClockMs(), rotY: 0,
      });
      if (this._soundEngine) this._soundEngine.play(`navDrill${level + 1}`);

      if (level === navGrid.REGION) {
        // ⛔ AND UNDER A VIEW MODE THAT 0.5 IS THE WRONG ANGLE. The two 240p designs read the game's
        // own rotation now, and they were drawn at atan2(0.42, 0.55) = 0.652, so a settle to 0.5
        // leaves the prism ~8 degrees off the frame Max ruled on for the rest of the drill.
        // `_seedViewModeCam` owns that number and retargets an in-flight `_tiltAnim`; with no mode
        // active it returns before touching anything, so the legacy autopilot drill is unchanged.
        this._nav._seedViewModeCam?.();
        console.log(`[NAV-SEQ] Drill anim started → level 3, waiting for stars...`);
        // Wait for stars to load, then select
        this._delay(2000 + simRandom() * 500, () => this._selectStar(dest));
        return;
      }
      // Pause on the new screen (sector 1.5-2.5s, region 1.5-2s), then the next step
      const pause = level === navGrid.GALAXY ? 1500 + simRandom() * 1000 : 1500 + simRandom() * 500;
      this._delay(pause, () => this._hoverThenDrill(dest, level + 1));
    });
  }

  /** Set up prism view directly (no animation from 2D level) — the destination's own fixed column,
   *  entered through the same `navDrill.jumpTo` → `navGrid.enterColumn` the drill uses. ⛔ It used to
   *  be an adaptive density box around the destination and a synthetic 0.01 kpc REGION frame. */
  _setupPrismView(dest) {
    const column = navGrid.parentAt(navGrid.PRISM, dest.x, dest.z);
    console.log(`[NAV-SEQ] _setupPrismView: dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) prevLevel=${this._nav._levelIndex} column=${navGrid.addressKey(column)}`);
    navDrill.jumpTo(this._nav, navGrid.PRISM, column, { y: dest.y || 0 });
    this._nav._localRotX = 0.5;
    this._nav._localRotY = 0;
    this._nav._seedViewModeCam?.();   // same reason as the tilt above: no-op without a view mode
  }

  // ── Star selection ──

  _selectStar(dest, retries = 0) {
    if (this._aborted) return;

    const stars = this._nav._localStars;
    const levelIdx = this._nav._levelIndex;
    const hasAnim = !!this._nav._anim;

    console.log(`[NAV-SEQ] _selectStar retry=${retries} stars=${stars?.length || 0} level=${levelIdx} anim=${hasAnim} dest=(${dest.x.toFixed(2)},${dest.z.toFixed(2)}) localCenter=(${this._nav._localCenter?.x?.toFixed(2)},${this._nav._localCenter?.z?.toFixed(2)}) viewStack[2]=${JSON.stringify(this._nav._viewStack?.[2]?.center)}`);

    // If still animating or not on prism level, wait
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
    const pick = sorted[Math.floor(simRandom() * pool)];

    console.log(`[NAV-SEQ] Selected star: ${pick.name} (${pick.spectral})`);

    this._nav._systemStar = pick;
    this._nav._selectedNavStar = pick;
    this._nav._externalTarget = { x: pick.wx, y: pick.wy, z: pick.wz, name: pick.name || '', key: pick.key };

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
    this._delay(2000 + simRandom() * 500, () => this._initiateWarp(pick));
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
        seed: star.seed, key: star.key, name: star.name, spectral: star.spectral,
      },
    };

    if (this._onWarpReady) {
      this._onWarpReady({
        worldX: star.wx, worldY: star.wy, worldZ: star.wz,
        seed: star.seed, key: star.key, name: star.name, type: star.spectral,
      });
    }

    this._finish();
  }

  // ── Style picker ──

  _pickStyle() {
    let roll = simRandom() * TOTAL_WEIGHT;
    for (const style of NAV_STYLES) {
      roll -= style.weight;
      if (roll <= 0) {
        // Avoid repeating the same style twice in a row
        if (style.name === this._lastStyle && NAV_STYLES.length > 1) {
          // Pick any other style
          const others = NAV_STYLES.filter(s => s.name !== this._lastStyle);
          return others[Math.floor(simRandom() * others.length)].name;
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
      const R = 6 + simRandom() * 4;
      dest = { x: R * Math.cos(angle), z: R * Math.sin(angle), y: 0, label: 'Far Side' };
    }

    this._recentDests.push({ x: dest.x, z: dest.z });
    if (this._recentDests.length > 5) this._recentDests.shift();
    return dest;
  }

  /** Pick a destination near the current position (for prism_scroll / nearby_pick) */
  _pickNearbyDestination() {
    const px = this._playerPos.x || 8;
    const pz = this._playerPos.z || 0;
    const py = this._playerPos.y || 0;
    // Nearby: within 0.5-2 kpc, random direction
    const angle = simRandom() * Math.PI * 2;
    const dist = 0.5 + simRandom() * 1.5;
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
        const R = 2 + simRandom() * 11;
        const k = 1 / Math.tan(0.22);
        const theta = k * Math.log(R / 4.0) + arm.offset;
        const scatter = (simRandom() - 0.5) * 2.0;
        return {
          x: R * Math.cos(theta) + scatter * Math.sin(theta),
          z: R * Math.sin(theta) - scatter * Math.cos(theta),
          y: 0, label: arm.name,
        };
      }
      case 'core': {
        const a = simRandom() * Math.PI * 2;
        const R = 0.5 + simRandom() * 2.0;
        return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Galactic Core' };
      }
      case 'rim': {
        const a = simRandom() * Math.PI * 2;
        const R = 12 + simRandom() * 2;
        return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Galactic Rim' };
      }
      case 'vertical': {
        const a = simRandom() * Math.PI * 2;
        const R = 4 + simRandom() * 6;
        const y = (simRandom() > 0.5 ? 1 : -1) * (0.15 + simRandom() * 0.3);
        return { x: R * Math.cos(a), z: R * Math.sin(a), y, label: `${y > 0 ? 'Above' : 'Below'} the Disk` };
      }
      case 'opposite': {
        const a = Math.atan2(pz, px) + Math.PI + (simRandom() - 0.5) * 0.8;
        const R = Math.max(2, Math.min(13, Math.sqrt(px * px + pz * pz) + (simRandom() - 0.5) * 6));
        return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Far Side' };
      }
      default: return this._fallback(px, pz);
    }
  }

  _fallback(px, pz) {
    const a = simRandom() * Math.PI * 2;
    const R = 3 + simRandom() * 8;
    return { x: R * Math.cos(a), z: R * Math.sin(a), y: 0, label: 'Deep Space' };
  }

  // ── Cursor positioning helpers ──

  /**
   * Set the blinking cursor on a galactic point, at the texel the map ON THE GLASS draws it —
   * a 240p design's published `S.mapProj`, else the legacy map square (`navDrill.screenPointOf`).
   * ⛔ IT USED TO HAVE ITS OWN PROJECTION (a fixed −22…+22 kpc square in `min(w, drawH) * 0.85`),
   * which never agreed with `_render2DLevel`'s and so put the crosshair ~20-25 px off the tile it
   * pointed at; with the autopilot now drilling the pilot's own cells, the cursor sits on the cell it
   * lights (naming-prism-segments AC-4). Off the map it is clamped to the canvas.
   */
  _setCursorAtGalactic(gx, gz) {
    const canvas = this._nav._canvas;
    if (!canvas) return;
    const p = navDrill.screenPointOf(this._nav, gx, gz);
    this._nav._autoCursor = {
      x: Math.max(0, Math.min(canvas.width, p.x)),
      y: Math.max(0, Math.min(canvas.height, p.y)),
    };
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
