#!/usr/bin/env node
/**
 * generate-sol-textures.mjs
 *
 * Downloads NASA/SSS equirectangular textures for all Sol system bodies,
 * resizes to 1024x512, and generates KnownBodyProfiles.js entries +
 * SolarSystemData.js profileId patches.
 *
 * Usage:
 *   node scripts/generate-sol-textures.mjs           # download + resize all
 *   node scripts/generate-sol-textures.mjs --dry-run  # show what would be done
 *   node scripts/generate-sol-textures.mjs earth mars  # only specific bodies
 *
 * Requirements:
 *   npm install sharp (already in project via image-process MCP)
 *   curl must be available
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const TEXTURE_DIR = join(PROJECT_ROOT, 'public/assets/textures/bodies');
const PROFILES_FILE = join(PROJECT_ROOT, 'src/data/KnownBodyProfiles.js');
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 512;

// ── Body definitions ──
// Each entry: id, name, texture URLs, which SolarSystemData planet/moon it maps to
const BODIES = [
  // Planets
  {
    id: 'sol-mercury',
    name: 'Mercury',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/8k_mercury.jpg',
    heightmapUrl: null, // USGS DEM is GeoTIFF, skip for now
    planetIndex: 0, // Mercury is planet[0] in SolarSystemData
    moonIndex: null,
  },
  {
    id: 'sol-venus',
    name: 'Venus',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/8k_venus_surface.jpg',
    heightmapUrl: null,
    planetIndex: 1,
    moonIndex: null,
  },
  {
    id: 'sol-earth',
    name: 'Earth',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg',
    heightmapUrl: null, // SSS normal map isn't a heightmap
    planetIndex: 2,
    moonIndex: null,
    notes: 'Cloud-free daymap. Could add cloud layer separately.',
  },
  // Moon already done (sol-moon)
  {
    id: 'sol-mars',
    name: 'Mars',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/8k_mars.jpg',
    heightmapUrl: null, // USGS MOLA DEM is GeoTIFF
    planetIndex: 3,
    moonIndex: null,
  },
  // Ceres — no texture readily available, skip
  {
    id: 'sol-jupiter',
    name: 'Jupiter',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/8k_jupiter.jpg',
    heightmapUrl: null, // gas giant
    planetIndex: 5, // index 4 is Ceres
    moonIndex: null,
  },
  {
    id: 'sol-saturn',
    name: 'Saturn',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/8k_saturn.jpg',
    heightmapUrl: null, // gas giant
    planetIndex: 6,
    moonIndex: null,
    notes: 'Ring texture handled separately.',
  },
  {
    id: 'sol-uranus',
    name: 'Uranus',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/2k_uranus.jpg',
    heightmapUrl: null,
    planetIndex: 7,
    moonIndex: null,
    notes: 'Only 2k available — nearly featureless.',
  },
  {
    id: 'sol-neptune',
    name: 'Neptune',
    diffuseUrl: 'https://www.solarsystemscope.com/textures/download/2k_neptune.jpg',
    heightmapUrl: null,
    planetIndex: 8,
    moonIndex: null,
    notes: 'Only 2k available.',
  },
  {
    id: 'sol-pluto',
    name: 'Pluto',
    // USGS GeoTIFF — will need conversion, but it's the only option
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Pluto_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif',
    heightmapUrl: null, // DEM is 16-bit, complex to process
    planetIndex: 9,
    moonIndex: null,
    notes: 'USGS GeoTIFF — Sharp can read it. One hemisphere gap-filled.',
    isGeoTiff: true,
  },

  // Major moons (with textures available)
  {
    id: 'sol-io',
    name: 'Io',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Io_GalileoSSI-Voyager_Global_Mosaic_ClrMerge_1km.tif',
    heightmapUrl: null,
    planetIndex: 5, // Jupiter
    moonIndex: 0,   // first moon listed
    isGeoTiff: true,
  },
  {
    id: 'sol-europa',
    name: 'Europa',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Europa_Voyager_GalileoSSI_global_mosaic_500m.tif',
    heightmapUrl: null,
    planetIndex: 5,
    moonIndex: 1,
    isGeoTiff: true,
    notes: 'Grayscale.',
  },
  {
    id: 'sol-ganymede',
    name: 'Ganymede',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Ganymede_Voyager_GalileoSSI_Global_ClrMosaic_1435m.tif',
    heightmapUrl: null,
    planetIndex: 5,
    moonIndex: 2,
    isGeoTiff: true,
    notes: '190MB source — large download.',
  },
  {
    id: 'sol-callisto',
    name: 'Callisto',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Callisto_Voyager_GalileoSSI_global_mosaic_1km.tif',
    heightmapUrl: null,
    planetIndex: 5,
    moonIndex: 3,
    isGeoTiff: true,
    notes: 'Grayscale.',
  },
  {
    id: 'sol-titan',
    name: 'Titan',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Titan_ISS_P19658_Mosaic_Global_4km.tif',
    heightmapUrl: null,
    planetIndex: 6, // Saturn
    moonIndex: 6,   // Titan is 7th moon in SolarSystemData (index 6)
    isGeoTiff: true,
    notes: 'Low res (4km/px) due to atmosphere. Surface barely visible.',
  },
  {
    id: 'sol-iapetus',
    name: 'Iapetus',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Iapetus_Cassini_Voyager_Mosaic_Global_783m.tif',
    heightmapUrl: null,
    planetIndex: 6, // Saturn
    moonIndex: 7,   // Iapetus is 8th moon in SolarSystemData (index 7)
    isGeoTiff: true,
    notes: 'Two-tone albedo — iconic dark/light hemispheres.',
  },
  {
    id: 'sol-triton',
    name: 'Triton',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Triton_Voyager2_ClrMosaic_GlobalFill_600m.tif',
    heightmapUrl: null,
    planetIndex: 8, // Neptune
    moonIndex: 0,
    isGeoTiff: true,
    notes: '287MB source. One hemisphere gap-filled.',
  },
  {
    id: 'sol-charon',
    name: 'Charon',
    diffuseUrl: 'https://planetarymaps.usgs.gov/mosaic/Charon_NewHorizons_Global_Mosaic_300m_Jul2017_8bit.tif',
    heightmapUrl: null,
    planetIndex: 9, // Pluto
    moonIndex: 0,
    isGeoTiff: true,
  },
];

// ── Main ──

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const filterBodies = args.filter(a => !a.startsWith('--'));

// Ensure output directory exists
if (!existsSync(TEXTURE_DIR)) {
  mkdirSync(TEXTURE_DIR, { recursive: true });
}

async function downloadAndResize(body) {
  const diffusePath = join(TEXTURE_DIR, `${body.id.replace('sol-', '')}_diffuse.jpg`);
  const heightmapPath = body.heightmapUrl
    ? join(TEXTURE_DIR, `${body.id.replace('sol-', '')}_heightmap.jpg`)
    : null;

  // Skip if already downloaded
  if (existsSync(diffusePath)) {
    console.log(`  ✓ ${body.name} diffuse already exists, skipping download`);
    return { diffusePath, heightmapPath, skipped: true };
  }

  if (dryRun) {
    console.log(`  [dry-run] Would download: ${body.diffuseUrl}`);
    console.log(`  [dry-run] Would save to: ${diffusePath}`);
    return { diffusePath, heightmapPath, skipped: true };
  }

  // Download diffuse
  const tempPath = diffusePath + '.tmp';
  console.log(`  Downloading ${body.name} diffuse...`);
  try {
    execSync(`curl -sL -o "${tempPath}" "${body.diffuseUrl}"`, {
      timeout: 300000, // 5 min timeout for large files
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (err) {
    console.error(`  ✗ Failed to download ${body.name}: ${err.message}`);
    return null;
  }

  // Resize with Sharp
  console.log(`  Resizing to ${TARGET_WIDTH}x${TARGET_HEIGHT}...`);
  try {
    // Dynamic import so the script doesn't fail if sharp isn't installed
    const sharp = (await import('sharp')).default;
    await sharp(tempPath)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'fill' })
      .jpeg({ quality: 90 })
      .toFile(diffusePath);

    // Clean up temp
    execSync(`rm "${tempPath}"`);
  } catch (err) {
    console.error(`  ✗ Failed to resize ${body.name}: ${err.message}`);
    // If Sharp fails, try keeping the raw download (might be usable)
    if (existsSync(tempPath)) {
      execSync(`mv "${tempPath}" "${diffusePath}"`);
      console.log(`  ⚠ Kept raw download (not resized)`);
    }
    return null;
  }

  // Download heightmap if available
  if (body.heightmapUrl && heightmapPath) {
    console.log(`  Downloading ${body.name} heightmap...`);
    try {
      const hTempPath = heightmapPath + '.tmp';
      execSync(`curl -sL -o "${hTempPath}" "${body.heightmapUrl}"`, {
        timeout: 300000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      const sharp = (await import('sharp')).default;
      await sharp(hTempPath)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'fill' })
        .grayscale()
        .jpeg({ quality: 90 })
        .toFile(heightmapPath);
      execSync(`rm "${hTempPath}"`);
    } catch (err) {
      console.error(`  ⚠ Heightmap download/resize failed: ${err.message}`);
    }
  }

  console.log(`  ✓ ${body.name} done`);
  return { diffusePath, heightmapPath, skipped: false };
}

function generateProfileEntry(body) {
  const shortId = body.id.replace('sol-', '');
  const hasHeightmap = body.heightmapUrl != null;

  return `
  // ── ${body.name} ──
  '${body.id}': {
    name: '${body.name}',
    textures: {
      diffuse: 'assets/textures/bodies/${shortId}_diffuse.jpg',${hasHeightmap ? `
      heightmap: 'assets/textures/bodies/${shortId}_heightmap.jpg',` : ''}
    },
    heightScale: ${hasHeightmap ? '0.04' : '0.0'},
    posterizeLevels: 8.0,
    ditherEdgeWidth: 0.5,
  },`;
}

async function main() {
  const bodiesToProcess = filterBodies.length > 0
    ? BODIES.filter(b => filterBodies.some(f =>
        b.id.includes(f) || b.name.toLowerCase().includes(f.toLowerCase())))
    : BODIES;

  console.log(`\n=== Sol System Texture Generator ===`);
  console.log(`Processing ${bodiesToProcess.length} bodies${dryRun ? ' (DRY RUN)' : ''}...\n`);

  // Download and resize
  const results = [];
  for (const body of bodiesToProcess) {
    console.log(`[${body.name}]`);
    const result = await downloadAndResize(body);
    if (result) results.push({ body, ...result });
  }

  if (dryRun) {
    console.log('\n=== Dry run complete. No files modified. ===\n');
    return;
  }

  // Generate profile entries for new bodies
  console.log('\n=== Generated KnownBodyProfiles entries ===');
  console.log('Add these to src/data/KnownBodyProfiles.js:\n');
  for (const { body, skipped } of results) {
    console.log(generateProfileEntry(body));
  }

  // Generate SolarSystemData profileId patches
  console.log('\n\n=== SolarSystemData profileId mappings ===');
  console.log('Add profileId to each planet/moon entry:\n');
  for (const { body } of results) {
    if (body.moonIndex != null) {
      console.log(`  Planet[${body.planetIndex}].moons[${body.moonIndex}]: profileId: '${body.id}'`);
    } else {
      console.log(`  Planet[${body.planetIndex}]: profileId: '${body.id}'`);
    }
  }

  console.log('\n=== Done! ===\n');
}

main().catch(console.error);
