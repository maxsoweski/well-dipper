#!/usr/bin/env node

/**
 * generate-galaxy-glow.mjs — Pre-render galaxy glow panorama textures.
 *
 * Generates equirectangular panoramas from a grid of viewpoints throughout
 * the galaxy. Each panorama captures the full 360° galaxy glow as seen
 * from that position. The game loads the nearest panorama at runtime.
 *
 * Usage:
 *   node scripts/generate-galaxy-glow.mjs              # full grid (240 textures)
 *   node scripts/generate-galaxy-glow.mjs --test       # 5 test positions only
 *   node scripts/generate-galaxy-glow.mjs --test --hires  # test at 1024x512
 *
 * Output: public/assets/glow/glow-manifest.json + PNG textures
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

// Import game modules (ESM)
import { GalacticMap } from '../src/generation/GalacticMap.js';
import { GalaxyVolumeRenderer } from '../src/generation/GalaxyVolumeRenderer.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'assets', 'glow');

// ── Configuration ──

const isTest = process.argv.includes('--test');
const isHires = process.argv.includes('--hires');

const WIDTH = isHires ? 1024 : 512;
const HEIGHT = isHires ? 512 : 256;
const SAMPLES = isTest ? 48 : 64;

// Grid definition
const GRID_R = [0, 2, 4, 6, 8, 10, 12, 14];      // kpc from center
const GRID_Z = [-3, -1, 0, 1, 3];                  // kpc above/below plane
const GRID_THETA = [0, Math.PI/3, 2*Math.PI/3, Math.PI, 4*Math.PI/3, 5*Math.PI/3]; // radians

// Test positions — key visual regimes
const TEST_POSITIONS = [
  { R: 8, z: 0, theta: 0, label: 'solar-neighborhood' },
  { R: 0.5, z: 0, theta: 0, label: 'galactic-center' },
  { R: 14, z: 0, theta: 0, label: 'outer-rim' },
  { R: 8, z: 3, theta: 0, label: 'above-disk' },
  { R: 4, z: 0, theta: Math.PI/2, label: 'inner-arm' },
];

// ── Main ──

console.log(`Galaxy Glow Generator`);
console.log(`Mode: ${isTest ? 'TEST (5 positions)' : 'FULL GRID (240 positions)'}`);
console.log(`Resolution: ${WIDTH}×${HEIGHT}, Samples/ray: ${SAMPLES}`);
console.log('');

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Initialize galaxy
const galacticMap = new GalacticMap('well-dipper-galaxy-1');
const renderer = new GalaxyVolumeRenderer(galacticMap);

// Build the list of viewpoints
const viewpoints = [];

if (isTest) {
  for (const tp of TEST_POSITIONS) {
    viewpoints.push({
      pos: {
        x: tp.R * Math.cos(tp.theta),
        y: tp.z,
        z: tp.R * Math.sin(tp.theta),
      },
      R: tp.R,
      z: tp.z,
      theta: tp.theta,
      label: tp.label,
      filename: `glow-test-${tp.label}.png`,
    });
  }
} else {
  for (let ri = 0; ri < GRID_R.length; ri++) {
    for (let zi = 0; zi < GRID_Z.length; zi++) {
      for (let ti = 0; ti < GRID_THETA.length; ti++) {
        const R = GRID_R[ri];
        const z = GRID_Z[zi];
        const theta = GRID_THETA[ti];

        // Skip: R=0 doesn't need multiple theta values (isotropic at center)
        if (R === 0 && ti > 0) continue;

        const rIdx = String(ri).padStart(2, '0');
        const zIdx = String(zi).padStart(2, '0');
        const tIdx = String(ti).padStart(2, '0');

        viewpoints.push({
          pos: {
            x: R * Math.cos(theta),
            y: z,
            z: R * Math.sin(theta),
          },
          R, z, theta,
          label: `R${GRID_R[ri]}-Z${GRID_Z[zi]}-T${ti}`,
          filename: `glow-R${rIdx}-Z${zIdx}-T${tIdx}.png`,
          gridIndex: { ri, zi, ti },
        });
      }
    }
  }
}

console.log(`Generating ${viewpoints.length} panoramas...`);
console.log('');

const startTime = Date.now();

for (let i = 0; i < viewpoints.length; i++) {
  const vp = viewpoints[i];
  const t0 = Date.now();

  // Render panorama
  const pixels = renderer.renderPanorama(vp.pos, WIDTH, HEIGHT, {
    samples: SAMPLES,
    maxDist: 20,
    retroEffects: true,
    brightnessMax: 0.20,
    chunkyScale: 3,
  });

  // Encode to PNG
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  png.data = Buffer.from(pixels.buffer);
  const pngBuffer = PNG.sync.write(png);

  // Write file
  const outPath = join(OUTPUT_DIR, vp.filename);
  writeFileSync(outPath, pngBuffer);

  const elapsed = Date.now() - t0;
  const sizeKB = (pngBuffer.length / 1024).toFixed(1);
  const pct = ((i + 1) / viewpoints.length * 100).toFixed(0);
  console.log(`  [${pct}%] ${vp.label} → ${vp.filename} (${sizeKB} KB, ${elapsed}ms)`);
}

// Write manifest
const manifest = {
  version: 1,
  textureSize: [WIDTH, HEIGHT],
  grid: {
    R: GRID_R,
    z: GRID_Z,
    theta: GRID_THETA,
  },
  files: {},
};

for (const vp of viewpoints) {
  if (vp.gridIndex) {
    const key = `R${String(vp.gridIndex.ri).padStart(2, '0')}-Z${String(vp.gridIndex.zi).padStart(2, '0')}-T${String(vp.gridIndex.ti).padStart(2, '0')}`;
    manifest.files[key] = vp.filename;
  }
}

writeFileSync(
  join(OUTPUT_DIR, 'glow-manifest.json'),
  JSON.stringify(manifest, null, 2)
);

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log('');
console.log(`Done! ${viewpoints.length} panoramas in ${totalTime}s`);
console.log(`Output: ${OUTPUT_DIR}/`);
