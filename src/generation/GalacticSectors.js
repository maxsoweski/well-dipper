import { GalacticMap } from './GalacticMap.js';

/**
 * GalacticSectors — persistent named sectors of the galaxy.
 *
 * Divides the galaxy into ~1,000 irregularly-sized sectors, each containing
 * roughly the same number of navigable stars. Dense regions (galactic center)
 * get small sectors; sparse regions (outer rim) get large ones.
 *
 * Sectors are deterministic — same galaxy seed always produces the same
 * sectors with the same names and boundaries. This makes them usable as
 * persistent gameplay entities (quests, factions, territory, lore).
 *
 * Uses a density-weighted grid: the galaxy is divided into a base grid,
 * then dense cells are subdivided further until each cell contains a
 * target number of stars.
 */
export class GalacticSectors {
  /**
   * @param {GalacticMap} galacticMap
   * @param {string} seed — galaxy seed (for deterministic naming)
   */
  constructor(galacticMap, seed) {
    this._gm = galacticMap;
    this._seed = seed;
    this._sectors = null; // lazy init
    this._sectorGrid = null;
  }

  /**
   * Get all sectors (generates on first call, cached forever).
   * @returns {Array<Sector>}
   */
  getSectors() {
    if (!this._sectors) this._generate();
    return this._sectors;
  }

  /**
   * Find which sector contains a given galactic position.
   * @param {{ x: number, z: number }} pos — galactic coordinates (kpc)
   * @returns {Sector|null}
   */
  getSectorAt(pos) {
    if (!this._sectors) this._generate();
    const R = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
    if (R > GalacticMap.GALAXY_RADIUS * 1.2) return null;

    // Find nearest sector center
    let best = null;
    let bestDist = Infinity;
    for (const sector of this._sectors) {
      const dx = pos.x - sector.centerX;
      const dz = pos.z - sector.centerZ;
      const d = dx * dx + dz * dz;
      if (d < bestDist) {
        bestDist = d;
        best = sector;
      }
    }
    return best;
  }

  /**
   * Get sectors visible in a rectangular region.
   * @param {number} minX, maxX, minZ, maxZ — bounds in kpc
   * @returns {Array<Sector>}
   */
  getSectorsInBounds(minX, maxX, minZ, maxZ) {
    if (!this._sectors) this._generate();
    return this._sectors.filter(s =>
      s.centerX >= minX && s.centerX <= maxX &&
      s.centerZ >= minZ && s.centerZ <= maxZ
    );
  }

  // ════════════════════════════════════════════════════
  // GENERATION
  // ════════════════════════════════════════════════════

  _generate() {
    const sectors = [];
    const targetStarsPerSector = 50000000; // ~50M stars per sector → ~1000 sectors

    // Density-adaptive grid: start with a coarse grid, subdivide dense cells
    const baseGridSize = 4.0; // kpc — initial cell size
    const galaxyR = GalacticMap.GALAXY_RADIUS;

    // Phase 1: Create base grid cells covering the galaxy
    const baseCells = [];
    const nBase = Math.ceil(galaxyR * 2 / baseGridSize);
    const offset = -galaxyR;

    for (let ix = 0; ix < nBase; ix++) {
      for (let iz = 0; iz < nBase; iz++) {
        const cx = offset + (ix + 0.5) * baseGridSize;
        const cz = offset + (iz + 0.5) * baseGridSize;
        const R = Math.sqrt(cx * cx + cz * cz);

        // Skip cells far outside the galaxy
        if (R > galaxyR * 1.5) continue;
        // Skip cells with truly negligible density (very sparse outer halo)
        const d = this._estimateDensity(cx, cz);
        if (d < 0.0001) continue;

        baseCells.push({
          cx, cz,
          size: baseGridSize,
          ix, iz,
          depth: 0,
        });
      }
    }

    // Phase 2: Estimate star count per cell and subdivide dense ones
    const finalCells = [];
    const queue = [...baseCells];

    while (queue.length > 0) {
      const cell = queue.pop();
      const density = this._estimateDensity(cell.cx, cell.cz);
      const volume = cell.size * cell.size * 1.0; // assume 1 kpc height for estimation
      const estimatedStars = density * volume * 1e9 * 0.14; // rough star count

      if (estimatedStars > targetStarsPerSector * 2 && cell.depth < 4) {
        // Subdivide into 4
        const halfSize = cell.size / 2;
        const qSize = halfSize / 2;
        for (let di = 0; di < 2; di++) {
          for (let dj = 0; dj < 2; dj++) {
            const subCx = cell.cx - qSize + di * halfSize;
            const subCz = cell.cz - qSize + dj * halfSize;
            const subR = Math.sqrt(subCx * subCx + subCz * subCz);
            if (subR > galaxyR * 1.5) continue;

            queue.push({
              cx: subCx, cz: subCz,
              size: halfSize,
              ix: cell.ix * 2 + di,
              iz: cell.iz * 2 + dj,
              depth: cell.depth + 1,
            });
          }
        }
      } else {
        finalCells.push(cell);
      }
    }

    // Phase 3: Generate sector data from final cells
    const hashFn = this._makeHash(this._seed);

    for (let i = 0; i < finalCells.length; i++) {
      const cell = finalCells[i];
      const R = Math.sqrt(cell.cx * cell.cx + cell.cz * cell.cz);
      const theta = Math.atan2(cell.cz, cell.cx);
      const armInfo = this._gm.nearestArmInfo
        ? this._gm.nearestArmInfo(R, theta)
        : null;

      // Deterministic name from position hash
      const nameHash = hashFn(cell.cx * 1000, cell.cz * 1000, cell.depth);
      const name = this._generateSectorName(nameHash, R, armInfo, i);

      sectors.push({
        id: i,
        name,
        centerX: cell.cx,
        centerZ: cell.cz,
        size: cell.size,
        depth: cell.depth,
        R: R,
        // Bounds for quick lookup
        minX: cell.cx - cell.size / 2,
        maxX: cell.cx + cell.size / 2,
        minZ: cell.cz - cell.size / 2,
        maxZ: cell.cz + cell.size / 2,
      });
    }

    this._sectors = sectors;
    console.log(`GalacticSectors: generated ${sectors.length} sectors`);
  }

  /**
   * Estimate average density at a position (fast, for subdivision decisions).
   */
  _estimateDensity(x, z) {
    const R = Math.sqrt(x * x + z * z);
    const d = this._gm.potentialDerivedDensity(R, 0);
    const theta = Math.atan2(z, x);
    const armStr = this._gm.spiralArmStrength(R, theta);
    return d.totalDensity * (1 + armStr * 2.5);
  }

  /**
   * Generate a sector name from a hash value.
   * Placeholder system — will be replaced with astronomical naming conventions.
   */
  _generateSectorName(hash, R, armInfo, index) {
    // Greek letter prefixes for inner/outer distinction
    const greekPrefixes = [
      'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta',
      'Eta', 'Theta', 'Iota', 'Kappa', 'Lambda', 'Mu',
      'Nu', 'Xi', 'Omicron', 'Pi', 'Rho', 'Sigma',
      'Tau', 'Upsilon', 'Phi', 'Chi', 'Psi', 'Omega',
    ];

    // Region names based on spiral arms and galactic position
    const regionNames = [
      'Centaurus', 'Perseus', 'Sagittarius', 'Norma', 'Cygnus',
      'Orion', 'Carina', 'Scutum', 'Aquila', 'Vela',
      'Lupus', 'Crux', 'Ara', 'Corvus', 'Hydra',
      'Fornax', 'Eridanus', 'Columba', 'Pyxis', 'Musca',
      'Triangulum', 'Dorado', 'Volans', 'Pictor', 'Caelum',
      'Puppis', 'Monoceros', 'Serpens', 'Ophiuchus', 'Scorpius',
    ];

    const h1 = Math.abs(hash) % greekPrefixes.length;
    const h2 = Math.abs(hash >> 8) % regionNames.length;
    const h3 = Math.abs(hash >> 16) % 100;

    return `${greekPrefixes[h1]} ${regionNames[h2]}-${h3}`;
  }

  /**
   * Simple deterministic hash function.
   */
  _makeHash(seed) {
    // FNV-1a style
    const seedNum = typeof seed === 'string'
      ? seed.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)
      : seed;

    return (x, z, depth) => {
      let h = seedNum;
      h = ((h ^ (x | 0)) * 0x01000193) | 0;
      h = ((h ^ (z | 0)) * 0x01000193) | 0;
      h = ((h ^ (depth | 0)) * 0x01000193) | 0;
      return h;
    };
  }

  /**
   * Compute the local tile size for navigable views within a sector.
   * Each tile targets ~100 stars.
   *
   * @param {number} x, z — position in kpc
   * @param {number} [targetStars=100]
   * @returns {number} tile width in kpc
   */
  static computeLocalTileSize(galacticMap, x, z, targetStars = 100) {
    const R = Math.sqrt(x * x + z * z);
    const d = galacticMap.potentialDerivedDensity(R, 0);
    const theta = Math.atan2(z, x);
    const armStr = galacticMap.spiralArmStrength(R, theta);
    const modDensity = d.totalDensity * (1 + armStr * 2.5);

    // Convert model density to stars/pc³ (approximate)
    const starsPerPc3 = Math.max(0.01, modDensity * 0.14 / 0.065);

    // Volume needed for targetStars
    const volume = targetStars / starsPerPc3;
    return Math.cbrt(volume) / 1000; // convert pc to kpc
  }
}
