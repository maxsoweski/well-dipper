/**
 * AutopilotNavSequence — Scripts a cinematic nav computer drill-down for autopilot warps.
 *
 * When the autopilot tour completes, instead of silently picking a random star,
 * this opens the nav computer and visually navigates through the galaxy levels:
 *   Galaxy → Sector → Region → Column → Star selection → Warp
 *
 * Each level pauses briefly so the viewer sees the galaxy's structure, then
 * drills down to the next level, showcasing different parts of the Milky Way.
 *
 * Destination picking favors galactically interesting locations:
 * - Different spiral arm from current position
 * - Core/bulge if currently in the disk
 * - Known features (nebulae, clusters) nearby
 * - Minimum distance from current position for visual variety
 */

// Interesting galactic regions to visit (kpc coordinates)
// Covers different arms, core, rim, and above/below the plane
const DESTINATIONS = [
  // Sagittarius Arm (inner)
  { x: 5.5, z: 1.5, label: 'Sagittarius Arm' },
  { x: 6.0, z: -2.0, label: 'Sagittarius Arm (far)' },
  // Perseus Arm (outer)
  { x: 10.5, z: 1.0, label: 'Perseus Arm' },
  { x: 11.0, z: -2.5, label: 'Perseus Arm (far)' },
  // Scutum-Centaurus Arm
  { x: 4.0, z: 3.0, label: 'Scutum-Centaurus Arm' },
  { x: 3.5, z: -1.0, label: 'Scutum-Centaurus Arm (near)' },
  // Norma Arm (inner)
  { x: 3.0, z: 0.5, label: 'Norma Arm' },
  // Outer Arm
  { x: 13.0, z: 0.0, label: 'Outer Arm' },
  { x: 12.0, z: 3.0, label: 'Outer Arm (north)' },
  // Near the galactic core
  { x: 1.5, z: 0.5, label: 'Near Core' },
  { x: 2.0, z: -0.5, label: 'Inner Galaxy' },
  // Local neighborhood variations
  { x: 8.5, z: 0.5, label: 'Local Spur' },
  { x: 7.5, z: -0.5, label: 'Orion Arm (inward)' },
  { x: 9.0, z: -1.5, label: 'Orion Arm (outward)' },
  // Above/below the plane
  { x: 8.0, z: 0.0, y: 0.3, label: 'Above the Disk' },
  { x: 7.0, z: 1.0, y: -0.2, label: 'Below the Disk' },
];

export class AutopilotNavSequence {
  /**
   * @param {object} opts
   * @param {object} opts.navComputer — NavComputer instance
   * @param {object} opts.galacticMap — GalacticMap instance
   * @param {Function} opts.openNavComputer — opens the nav UI (main.js function)
   * @param {Function} opts.closeNavComputer — closes the nav UI
   * @param {Function} opts.onWarpReady — called with {star} when ready to warp
   * @param {Function} opts.onComplete — called when the whole sequence finishes (warp initiated or aborted)
   * @param {object} opts.soundEngine — for drill sounds
   * @param {{x,y,z}} opts.playerPos — current galactic position
   */
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
    this._visitedIndex = -1; // track which destination was last used
  }

  get isActive() { return this._active; }

  /**
   * Start the cinematic drill-down sequence.
   * Call this from onTourComplete instead of autoSelectWarpTarget.
   */
  start() {
    if (this._active) return;
    this._active = true;
    this._aborted = false;

    // Pick a destination far from current position
    const dest = this._pickDestination();
    if (!dest) {
      console.warn('[NAV-SEQ] No suitable destination found, aborting');
      this._finish();
      return;
    }

    console.log(`[NAV-SEQ] Destination: ${dest.label} (${dest.x.toFixed(1)}, ${dest.z.toFixed(1)})`);

    // Open the nav computer to galaxy view
    this._openNav();

    // Small delay for nav to initialize, then start at galaxy level
    this._delay(300, () => {
      if (this._aborted) return;

      // Force to galaxy view (level 0)
      this._nav._levelIndex = 0;
      this._nav._viewCenter = { x: 0, z: 0 };
      this._nav._viewSize = 44;
      this._nav._viewStack = [];
      this._nav._hoveredTile = null;
      this._nav._localStars = [];
      this._nav._resetColumnLoad();

      if (this._soundEngine) this._soundEngine.play('navDrill0');

      // Pause at galaxy level (2.5s) — viewer sees the full Milky Way
      this._delay(2500, () => this._drillToSector(dest));
    });
  }

  /** Abort the sequence (e.g., user input during autopilot). */
  abort() {
    if (!this._active) return;
    this._aborted = true;
    this._clearTimers();
    this._finish();
  }

  // ── Drill-down steps ──

  _drillToSector(dest) {
    if (this._aborted) return;

    // Find the sector that contains our destination
    const sectorCol = Math.floor(((dest.x + 22) / 44) * 8);
    const sectorRow = Math.floor(((dest.z + 22) / 44) * 8);
    const sectorSize = 44 / 8; // 5.5 kpc
    const sectorCx = -22 + (sectorCol + 0.5) * sectorSize;
    const sectorCz = -22 + (sectorRow + 0.5) * sectorSize;

    // Push to view stack
    this._nav._viewStack[1] = { center: { x: sectorCx, z: sectorCz }, size: sectorSize };

    // Animate drill from galaxy to sector
    this._nav._startDrillAnim(
      { x: this._nav._viewCenter.x, z: this._nav._viewCenter.z }, this._nav._viewSize,
      { x: sectorCx, z: sectorCz }, sectorSize,
      1, 600
    );

    if (this._soundEngine) this._soundEngine.play('navDrill1');

    // Pause at sector level (2s)
    this._delay(2600, () => this._drillToRegion(dest, sectorCx, sectorCz, sectorSize));
  }

  _drillToRegion(dest, parentCx, parentCz, parentSize) {
    if (this._aborted) return;

    // Find the region tile within this sector
    const gn = 16; // region uses 16x16 grid
    const tileSize = parentSize / gn;
    const ext = parentSize / 2;
    const col = Math.floor((dest.x - (parentCx - ext)) / tileSize);
    const row = Math.floor((dest.z - (parentCz - ext)) / tileSize);
    const clampedCol = Math.max(0, Math.min(gn - 1, col));
    const clampedRow = Math.max(0, Math.min(gn - 1, row));
    const regionCx = parentCx - ext + (clampedCol + 0.5) * tileSize;
    const regionCz = parentCz - ext + (clampedRow + 0.5) * tileSize;

    this._nav._viewStack[2] = { center: { x: regionCx, z: regionCz }, size: tileSize };

    // Animate drill from sector to region
    this._nav._startDrillAnim(
      { x: this._nav._viewCenter.x, z: this._nav._viewCenter.z }, this._nav._viewSize,
      { x: regionCx, z: regionCz }, tileSize,
      2, 500
    );

    if (this._soundEngine) this._soundEngine.play('navDrill2');

    // Pause at region level (1.8s)
    this._delay(2300, () => this._drillToColumn(dest, regionCx, regionCz, tileSize));
  }

  _drillToColumn(dest, regionCx, regionCz, regionSize) {
    if (this._aborted) return;

    const destY = dest.y || 0;

    // Set up column view centered on destination
    this._nav._localCenter = { x: dest.x, y: destY, z: dest.z };
    this._nav._localCubeSize = Math.max(0.003, regionSize * 0.5);
    this._nav._localRadius = 0.0015;
    this._nav._localGridCell = 0.001;
    this._nav._localStars = [];
    this._nav._resetColumnLoad();

    // Tilt animation (top-down → angled)
    this._nav._localRotX = Math.PI / 2;
    this._nav._localRotY = 0;
    this._nav._tiltAnim = {
      startTime: performance.now(),
      duration: 600,
      from: Math.PI / 2,
      to: 0.5,
    };

    // Zoom animation into region
    const localSize = regionSize * 0.8;
    this._nav._startDrillAnim(
      { x: this._nav._viewCenter.x, z: this._nav._viewCenter.z }, this._nav._viewSize,
      { x: dest.x, z: dest.z }, localSize,
      3, 600
    );

    if (this._soundEngine) this._soundEngine.play('navDrill3');

    // Wait for stars to load, then pick one (2.5s + polling)
    this._delay(2500, () => this._selectStar(dest));
  }

  _selectStar(dest, retries = 0) {
    if (this._aborted) return;

    const stars = this._nav._localStars;
    if ((!stars || stars.length === 0) && retries < 10) {
      // Stars still loading — retry in 300ms
      this._delay(300, () => this._selectStar(dest, retries + 1));
      return;
    }

    if (!stars || stars.length === 0) {
      console.warn('[NAV-SEQ] No stars loaded after retries, aborting');
      this._finish();
      return;
    }

    // Pick a star — prefer one close to the destination center,
    // but not the absolute nearest (some randomness)
    const sorted = [...stars].sort((a, b) => {
      const da = (a.wx - dest.x) ** 2 + (a.wz - dest.z) ** 2;
      const db = (b.wx - dest.x) ** 2 + (b.wz - dest.z) ** 2;
      return da - db;
    });
    // Pick from top 5 nearest (random)
    const pick = sorted[Math.floor(Math.random() * Math.min(5, sorted.length))];

    console.log(`[NAV-SEQ] Selected star: ${pick.name} (${pick.spectral})`);

    // Set the star as selected
    this._nav._systemStar = pick;
    this._nav._selectedNavStar = pick;
    this._nav._externalTarget = { x: pick.wx, y: pick.wy, z: pick.wz, name: pick.name || '' };

    // Zoom into system view
    this._nav._systemZoomAnim = {
      startTime: performance.now(),
      duration: 500,
      fromRadius: this._nav._localRadius,
      toRadius: this._nav._localRadius * 0.1,
      starPos: { x: pick.wx, y: pick.wy, z: pick.wz },
      fromCenter: { ...this._nav._localCenter },
    };

    if (this._soundEngine) this._soundEngine.play('navDrill4');

    // Pause at system view (2s) then initiate warp
    this._delay(2500, () => this._initiateWarp(pick));
  }

  _initiateWarp(star) {
    if (this._aborted) return;

    console.log(`[NAV-SEQ] Initiating warp to ${star.name}`);

    // Build the warp data in the format main.js expects
    const warpStar = {
      worldX: star.wx, worldY: star.wy, worldZ: star.wz,
      seed: star.seed, name: star.name, type: star.spectral,
    };

    // Close nav computer
    // We set the pending action so closeNavComputer dispatches it
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

    // Signal completion — main.js will handle closing nav + starting warp
    if (this._onWarpReady) {
      this._onWarpReady(warpStar);
    }

    this._finish();
  }

  // ── Destination picking ──

  _pickDestination() {
    const px = this._playerPos.x || 8;
    const pz = this._playerPos.z || 0;

    // Filter out destinations too close to current position (< 2 kpc)
    const candidates = DESTINATIONS.filter(d => {
      const dx = d.x - px;
      const dz = d.z - pz;
      return Math.sqrt(dx * dx + dz * dz) > 2.0;
    });

    if (candidates.length === 0) return DESTINATIONS[0]; // fallback

    // Pick randomly, but avoid repeating the last destination
    let pick;
    let attempts = 0;
    do {
      pick = candidates[Math.floor(Math.random() * candidates.length)];
      attempts++;
    } while (pick === DESTINATIONS[this._visitedIndex] && attempts < 5 && candidates.length > 1);

    this._visitedIndex = DESTINATIONS.indexOf(pick);
    return pick;
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
  }

  _finish() {
    this._clearTimers();
    this._active = false;
    if (this._onComplete) this._onComplete();
  }
}
