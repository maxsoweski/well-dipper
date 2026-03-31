#!/usr/bin/env node

/**
 * generate-galaxy-map.mjs — Render top-down and local views of the galaxy.
 *
 * Generates PNG images showing the galaxy structure from GalacticMap data:
 *   1. Full galaxy top-down (density, arms, features)
 *   2. Local sector views at specified positions
 *
 * Usage:
 *   node scripts/generate-galaxy-map.mjs                    # full galaxy + defaults
 *   node scripts/generate-galaxy-map.mjs --sector 8 0       # local view at R=8, z=0
 *   node scripts/generate-galaxy-map.mjs --sector 4 0 2     # local view, 2 kpc radius
 *
 * Output: public/assets/maps/
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';

import { GalacticMap } from '../src/generation/GalacticMap.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'public', 'assets', 'maps');

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const galacticMap = new GalacticMap('well-dipper-galaxy-1');

// ── Color utilities ──

function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = Math.round(r);
  png.data[idx + 1] = Math.round(g);
  png.data[idx + 2] = Math.round(b);
  png.data[idx + 3] = a;
}

function blendPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  const alpha = a / 255;
  png.data[idx] = Math.round(png.data[idx] * (1 - alpha) + r * alpha);
  png.data[idx + 1] = Math.round(png.data[idx + 1] * (1 - alpha) + g * alpha);
  png.data[idx + 2] = Math.round(png.data[idx + 2] * (1 - alpha) + b * alpha);
  png.data[idx + 3] = 255;
}

function drawCircle(png, cx, cy, radius, r, g, b) {
  for (let angle = 0; angle < Math.PI * 2; angle += 0.02) {
    const px = Math.round(cx + Math.cos(angle) * radius);
    const py = Math.round(cy + Math.sin(angle) * radius);
    setPixel(png, px, py, r, g, b);
  }
}

function drawCross(png, cx, cy, size, r, g, b) {
  for (let i = -size; i <= size; i++) {
    setPixel(png, cx + i, cy, r, g, b);
    setPixel(png, cx, cy + i, r, g, b);
  }
}

function writePng(png, filename) {
  const buffer = PNG.sync.write(png);
  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, buffer);
  console.log(`  → ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ── Galaxy density — delegates to GalacticMap (single source of truth) ──

function galaxyDensity(x, y) {
  const R = Math.sqrt(x * x + y * y);
  const theta = Math.atan2(y, x);

  // Density from gravitational potential model (includes thin + thick disk + bulge + halo)
  const d = galacticMap.potentialDerivedDensity(R, 0);
  const baseDensity = d.totalDensity;

  // Arm modulation from GalacticMap
  const armStr = galacticMap.spiralArmStrength(R, theta);
  const bulgeBlend = Math.max(0, Math.min(1, (R - 0.5) / 1.5));
  const interArmFloor = 0.1;
  const armFactor = (interArmFloor + armStr * (1.0 - interArmFloor + 2.0)) * bulgeBlend
                   + (1.0 - bulgeBlend);

  // Radial cutoff at disk edge
  const edgeFade = R > 13 ? Math.max(0, 1.0 - (R - 13) / 5) : 1.0;
  return baseDensity * armFactor * edgeFade;
}

// ═══════════════════════════════════════════════════════
// 1. FULL GALAXY TOP-DOWN
// ═══════════════════════════════════════════════════════

function renderFullGalaxy() {
  console.log('Generating full galaxy top-down view...');

  const SIZE = 1024;
  const png = new PNG({ width: SIZE, height: SIZE });

  // Galaxy extends ~16 kpc, generous padding to show full spiral arms
  const EXTENT = 28; // kpc — half-width of view
  const scale = SIZE / (EXTENT * 2);

  // First pass: compute density range
  let maxDensity = 0;
  const densityGrid = new Float64Array(SIZE * SIZE);

  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const gx = (px / SIZE - 0.5) * EXTENT * 2;
      const gy = -(py / SIZE - 0.5) * EXTENT * 2; // flip Y so north is up
      const d = galaxyDensity(gx, gy);
      densityGrid[py * SIZE + px] = d;
      if (d > maxDensity) maxDensity = d;
    }
  }

  // Second pass: render with color mapping
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const d = densityGrid[py * SIZE + px];

      // Log-stretch for visibility
      const norm = Math.log(1 + d * 50) / Math.log(1 + maxDensity * 50);
      const brightness = Math.pow(norm, 0.7);

      // Color: warm gold for bulge, blue-white for arms, cool gray for inter-arm
      const gx = (px / SIZE - 0.5) * EXTENT * 2;
      const gy = -(py / SIZE - 0.5) * EXTENT * 2;
      const R = Math.sqrt(gx * gx + gy * gy);

      let r, g, b;
      if (R < 1.5) {
        // Bulge: warm gold
        r = 255 * brightness;
        g = 220 * brightness;
        b = 150 * brightness;
      } else {
        // Disk: blue-white in arms, dimmer gray between
        const theta = Math.atan2(gy, gx);
        const armStr = galacticMap.spiralArmStrength
          ? galacticMap.spiralArmStrength(R, theta)
          : spiralArmStrengthFallback(R, theta);

        const armBlue = armStr * 0.3;
        r = (200 - armBlue * 80) * brightness;
        g = (210 - armBlue * 40) * brightness;
        b = (220 + armBlue * 35) * brightness;
      }

      setPixel(png, px, py, r, g, b);
    }
  }

  // ── Overlay: galactic features ──
  if (galacticMap._features) {
    const features = galacticMap._features;
    const featureColors = {
      'emission_nebula': [255, 80, 80],
      'open_cluster': [100, 180, 255],
      'globular_cluster': [255, 200, 50],
      'supernova_remnant': [255, 100, 255],
      'planetary_nebula': [100, 255, 200],
      'dark_nebula': [80, 80, 80],
      'ob_association': [150, 150, 255],
    };

    for (const f of features) {
      const px = Math.round((f.x / (EXTENT * 2) + 0.5) * SIZE);
      const py = Math.round((-f.y / (EXTENT * 2) + 0.5) * SIZE); // flip Y
      // Use z for the vertical position, but for top-down we use x,z as the plane
      // Actually in the game, x,z are the galactic plane and y is vertical
      const fpx = Math.round((f.x / (EXTENT * 2) + 0.5) * SIZE);
      const fpy = Math.round((-f.z / (EXTENT * 2) + 0.5) * SIZE);
      const color = featureColors[f.type] || [200, 200, 200];
      drawCross(png, fpx, fpy, 2, color[0], color[1], color[2]);
    }
  }

  // ── Overlay: Sun's position (R≈8 kpc) ──
  const sunPx = Math.round((8.0 / (EXTENT * 2) + 0.5) * SIZE);
  const sunPy = Math.round(0.5 * SIZE); // z=0
  drawCircle(png, sunPx, sunPy, 5, 255, 255, 0);
  drawCross(png, sunPx, sunPy, 8, 255, 255, 0);

  // ── Overlay: scale bar ──
  const barStart = 20;
  const barLen = Math.round(5 * scale); // 5 kpc bar
  for (let i = 0; i < barLen; i++) {
    setPixel(png, barStart + i, SIZE - 20, 255, 255, 255);
    setPixel(png, barStart + i, SIZE - 21, 255, 255, 255);
  }
  // Label: "5 kpc" — just draw tick marks at ends
  for (let i = -3; i <= 3; i++) {
    setPixel(png, barStart, SIZE - 20 + i, 255, 255, 255);
    setPixel(png, barStart + barLen, SIZE - 20 + i, 255, 255, 255);
  }

  // ── Overlay: arm labels (approximate positions) ──
  // Center crosshair
  drawCross(png, SIZE / 2, SIZE / 2, 4, 255, 100, 100);

  writePng(png, 'galaxy-topdown.png');
}

// ═══════════════════════════════════════════════════════
// 2. LOCAL SECTOR VIEW
// ═══════════════════════════════════════════════════════

function renderLocalSector(centerX, centerZ, radiusKpc, label) {
  console.log(`Generating local sector: ${label} (center=${centerX},${centerZ} radius=${radiusKpc} kpc)...`);

  const SIZE = 800;
  const png = new PNG({ width: SIZE, height: SIZE });

  const scale = SIZE / (radiusKpc * 2);

  // Background: density field
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const gx = centerX + (px / SIZE - 0.5) * radiusKpc * 2;
      const gz = centerZ + (py / SIZE - 0.5) * radiusKpc * 2;
      // Flip so galactic north is up
      const gzFlipped = centerZ - (py / SIZE - 0.5) * radiusKpc * 2;

      const d = galaxyDensity(gx, gzFlipped);
      const R = Math.sqrt(gx * gx + gzFlipped * gzFlipped);

      // Very subtle density background
      const norm = Math.min(1, d * 2000);
      const bg = norm * 0.15;
      setPixel(png, px, py, bg * 200, bg * 210, bg * 220);
    }
  }

  // Query stars in this region from the hash grid
  const pos = { x: centerX, y: 0, z: centerZ };

  // Try to get nearby stars from galacticMap
  // The hash grid stores stars by sector — query sectors that overlap our view
  let starCount = 0;
  const sectorSize = galacticMap.constructor.SECTOR_SIZE || 0.5;

  const minSX = Math.floor((centerX - radiusKpc) / sectorSize);
  const maxSX = Math.floor((centerX + radiusKpc) / sectorSize);
  const minSZ = Math.floor((centerZ - radiusKpc) / sectorSize);
  const maxSZ = Math.floor((centerZ + radiusKpc) / sectorSize);

  // Access the hash grid tiers
  const tiers = galacticMap._hashGridTiers || galacticMap.hashGridTiers;

  if (tiers) {
    const tierColors = [
      [180, 200, 255],  // O — blue-white
      [200, 210, 255],  // B — blue-white
      [240, 240, 255],  // A — white
      [255, 255, 230],  // F — yellow-white
      [255, 240, 180],  // G — yellow
      [255, 180, 100],  // K — orange
      [255, 120, 80],   // M — red
      [255, 150, 100],  // Kg — orange giant
      [255, 200, 80],   // Gg — yellow giant
      [255, 100, 60],   // Mg — red giant
    ];

    for (let ti = 0; ti < tiers.length; ti++) {
      const tier = tiers[ti];
      const color = tierColors[ti] || [200, 200, 200];

      // Sample sectors in our view
      for (let sx = minSX; sx <= maxSX; sx++) {
        for (let sz = minSZ; sz <= maxSZ; sz++) {
          // Generate stars for this sector using the hash grid
          const sectorX = sx * sectorSize + sectorSize / 2;
          const sectorZ = sz * sectorSize + sectorSize / 2;

          // Check if in view
          if (Math.abs(sectorX - centerX) > radiusKpc + sectorSize) continue;
          if (Math.abs(sectorZ - centerZ) > radiusKpc + sectorSize) continue;

          // Use the galacticMap to query what star types exist here
          const R = Math.sqrt(sectorX * sectorX + sectorZ * sectorZ);
          const theta = Math.atan2(sectorZ, sectorX);

          // Get density and arm strength to estimate if stars exist
          const density = galaxyDensity(sectorX, sectorZ);
          const armStr = galacticMap.spiralArmStrength
            ? galacticMap.spiralArmStrength(R, theta)
            : spiralArmStrengthFallback(R, theta);

          // Use density as probability of showing a star
          const starProb = Math.min(1, density * 500);
          // Deterministic hash for this position
          const hash = Math.sin(sx * 12345.6789 + sz * 98765.4321 + ti * 1111.1) * 0.5 + 0.5;

          if (hash < starProb) {
            // Position within sector (deterministic)
            const offsetX = (Math.sin(sx * 777 + sz * 333 + ti * 55) * 0.5 + 0.5) * sectorSize;
            const offsetZ = (Math.sin(sx * 444 + sz * 888 + ti * 77) * 0.5 + 0.5) * sectorSize;
            const starX = sx * sectorSize + offsetX;
            const starZ = sz * sectorSize + offsetZ;

            const px = Math.round((starX - centerX + radiusKpc) / (radiusKpc * 2) * SIZE);
            const py = Math.round((-(starZ - centerZ) + radiusKpc) / (radiusKpc * 2) * SIZE);

            if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) {
              // Size based on tier (O/B bigger, M smaller)
              const dotSize = ti < 2 ? 2 : ti < 5 ? 1 : 1;
              const bright = ti < 3 ? 1.0 : ti < 7 ? 0.7 : 0.5;
              for (let dx = -dotSize; dx <= dotSize; dx++) {
                for (let dy = -dotSize; dy <= dotSize; dy++) {
                  blendPixel(png, px + dx, py + dy,
                    color[0] * bright, color[1] * bright, color[2] * bright,
                    200);
                }
              }
              starCount++;
            }
          }
        }
      }
    }
  }

  // ── Features in view ──
  if (galacticMap._features) {
    const featureColors = {
      'emission_nebula': [255, 80, 80],
      'open_cluster': [100, 180, 255],
      'globular_cluster': [255, 200, 50],
      'supernova_remnant': [255, 100, 255],
      'planetary_nebula': [100, 255, 200],
      'dark_nebula': [120, 120, 120],
      'ob_association': [150, 150, 255],
    };

    for (const f of galacticMap._features) {
      // Features use x,z as galactic plane
      const dx = f.x - centerX;
      const dz = f.z - centerZ;
      if (Math.abs(dx) > radiusKpc || Math.abs(dz) > radiusKpc) continue;

      const px = Math.round((dx + radiusKpc) / (radiusKpc * 2) * SIZE);
      const py = Math.round((-dz + radiusKpc) / (radiusKpc * 2) * SIZE);
      const color = featureColors[f.type] || [200, 200, 200];

      // Draw feature as a small filled circle
      const featureR = Math.max(3, Math.round((f.radius || 0.05) * scale));
      for (let dy = -featureR; dy <= featureR; dy++) {
        for (let dx2 = -featureR; dx2 <= featureR; dx2++) {
          if (dx2 * dx2 + dy * dy <= featureR * featureR) {
            blendPixel(png, px + dx2, py + dy, color[0], color[1], color[2], 100);
          }
        }
      }
      // Cross marker
      drawCross(png, px, py, featureR + 2, color[0], color[1], color[2]);
    }
  }

  // ── Center marker ──
  drawCircle(png, SIZE / 2, SIZE / 2, 4, 255, 255, 0);
  drawCross(png, SIZE / 2, SIZE / 2, 6, 255, 255, 0);

  // ── Scale bar ──
  const barKpc = radiusKpc < 2 ? 0.5 : radiusKpc < 5 ? 1 : 2;
  const barLen = Math.round(barKpc * scale);
  for (let i = 0; i < barLen; i++) {
    setPixel(png, 20 + i, SIZE - 20, 255, 255, 255);
    setPixel(png, 20 + i, SIZE - 21, 255, 255, 255);
  }
  for (let i = -3; i <= 3; i++) {
    setPixel(png, 20, SIZE - 20 + i, 255, 255, 255);
    setPixel(png, 20 + barLen, SIZE - 20 + i, 255, 255, 255);
  }

  const safeName = label.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  writePng(png, `sector-${safeName}.png`);
  console.log(`    ${starCount} stars rendered`);
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// 3. NAV COMPUTER — LOCAL STAR MAP
// ═══════════════════════════════════════════════════════

function renderNavMap(centerX, centerZ, radiusKpc, label) {
  console.log(`Generating nav map: ${label} (center=${centerX},${centerZ} radius=${radiusKpc} kpc)...`);

  // Dynamic imports for name generation
  return import('../src/generation/NameGenerator.js').then(({ generateSystemName }) => {
    return import('alea').then(({ default: alea }) => {

      const SIZE = 1200;
      const png = new PNG({ width: SIZE, height: SIZE });
      const scale = SIZE / (radiusKpc * 2);

      // Dark background with subtle density
      for (let py = 0; py < SIZE; py++) {
        for (let px = 0; px < SIZE; px++) {
          const gx = centerX + (px / SIZE - 0.5) * radiusKpc * 2;
          const gz = centerZ - (py / SIZE - 0.5) * radiusKpc * 2;
          const d = galaxyDensity(gx, gz);
          const norm = Math.min(1, d * 2000);
          const bg = norm * 0.08;
          setPixel(png, px, py, bg * 150, bg * 160, bg * 180);
        }
      }

      // Get stars in this region
      const pos = { x: centerX, y: 0, z: centerZ };
      const maxStars = 500;
      const stars = galacticMap.findNearestStars(pos, maxStars, radiusKpc);

      console.log(`  Found ${stars.length} stars`);

      // RNG wrapper matching NameGenerator interface
      function makeRng(seed) {
        const fn = alea(seed);
        return {
          float: () => fn(),
          int: (max) => Math.floor(fn() * max),
          pick: (arr) => arr[Math.floor(fn() * arr.length)],
          bool: (p) => fn() < (p || 0.5),
          chance: (p) => fn() < p,
        };
      }

      // Render stars
      const labeled = [];
      for (const s of stars) {
        const px = Math.round((s.worldX - centerX + radiusKpc) / (radiusKpc * 2) * SIZE);
        const py = Math.round((-(s.worldZ - centerZ) + radiusKpc) / (radiusKpc * 2) * SIZE);

        if (px < 0 || px >= SIZE || py < 0 || py >= SIZE) continue;

        const dist = Math.sqrt(s.distSq);

        // Star color/size based on seed (deterministic)
        const rng = makeRng(s.seed);
        const typeRoll = rng.float();
        let color, dotSize;
        if (typeRoll < 0.01) { color = [150, 180, 255]; dotSize = 4; } // O/B
        else if (typeRoll < 0.05) { color = [220, 230, 255]; dotSize = 3; } // A
        else if (typeRoll < 0.15) { color = [255, 255, 230]; dotSize = 3; } // F
        else if (typeRoll < 0.30) { color = [255, 240, 180]; dotSize = 2; } // G (Sun-like)
        else if (typeRoll < 0.55) { color = [255, 200, 130]; dotSize = 2; } // K
        else { color = [255, 150, 100]; dotSize = 1; } // M

        // Draw star dot
        for (let dx = -dotSize; dx <= dotSize; dx++) {
          for (let dy = -dotSize; dy <= dotSize; dy++) {
            if (dx * dx + dy * dy <= dotSize * dotSize) {
              blendPixel(png, px + dx, py + dy, color[0], color[1], color[2], 220);
            }
          }
        }

        // Generate name for labeling (only label nearby/bright ones to avoid clutter)
        if (dist < radiusKpc * 0.8 && (dotSize >= 2 || dist < radiusKpc * 0.3)) {
          try {
            const nameRng = makeRng(s.seed);
            const name = generateSystemName(nameRng);
            if (name && name.trim().length > 0) {
              labeled.push({ px, py, name: name.trim(), dist, color });
            }
          } catch (e) {
            // Name generation can fail for some seeds, skip
          }
        }
      }

      // Draw labels (simple pixel text - just draw name as dots forming letters)
      // Since we can't render text in a PNG easily, let's use a simple approach:
      // draw a line from star to label position and write to a companion text file
      const labelData = [];
      for (const l of labeled.slice(0, 60)) {
        // Draw a small tick mark extending from the star
        const tickLen = 8;
        for (let i = 0; i < tickLen; i++) {
          blendPixel(png, l.px + i + 3, l.py - i - 1, l.color[0], l.color[1], l.color[2], 150);
        }
        // Small dot at end of tick
        blendPixel(png, l.px + tickLen + 3, l.py - tickLen - 1, 255, 255, 255, 200);

        const distPc = (l.dist * 1000).toFixed(0);
        labelData.push(`${l.name.padEnd(25)} ${distPc.padStart(5)} pc   pixel:(${l.px}, ${l.py})`);
      }

      // Center marker (player position)
      const cpx = SIZE / 2, cpy = SIZE / 2;
      drawCircle(png, cpx, cpy, 6, 0, 255, 100);
      drawCross(png, cpx, cpy, 10, 0, 255, 100);

      // Scale bar
      const barKpc = radiusKpc < 0.1 ? 0.01 : radiusKpc < 0.5 ? 0.1 : radiusKpc < 2 ? 0.5 : 1;
      const barLen = Math.round(barKpc * scale);
      for (let i = 0; i < barLen; i++) {
        setPixel(png, 20 + i, SIZE - 25, 200, 200, 200);
        setPixel(png, 20 + i, SIZE - 26, 200, 200, 200);
      }
      for (let i = -4; i <= 4; i++) {
        setPixel(png, 20, SIZE - 25 + i, 200, 200, 200);
        setPixel(png, 20 + barLen, SIZE - 25 + i, 200, 200, 200);
      }

      const safeName = label.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
      writePng(png, `nav-${safeName}.png`);

      // Write companion label file
      const labelPath = join(OUTPUT_DIR, `nav-${safeName}-labels.txt`);
      const header = `Nav Map: ${label}\nCenter: (${centerX}, ${centerZ}) kpc\nRadius: ${radiusKpc} kpc\nScale bar: ${barKpc} kpc\nStars: ${stars.length}\n\n`;
      writeFileSync(labelPath, header + labelData.join('\n') + '\n');
      console.log(`  → nav-${safeName}-labels.txt (${labelData.length} labeled stars)`);
    });
  });
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════

const args = process.argv.slice(2);

async function main() {
  if (args[0] === '--sector') {
    const x = parseFloat(args[1] || 8);
    const z = parseFloat(args[2] || 0);
    const r = parseFloat(args[3] || 2);
    renderLocalSector(x, z, r, `R${x}-Z${z}-r${r}`);
  } else if (args[0] === '--nav') {
    const x = parseFloat(args[1] || 8);
    const z = parseFloat(args[2] || 0);
    const r = parseFloat(args[3] || 0.2);
    await renderNavMap(x, z, r, `R${x}-Z${z}-r${r}`);
  } else {
    // Generate all default views
    renderFullGalaxy();
    await renderNavMap(8, 0, 0.15, 'solar-local');       // ~150 pc radius
    await renderNavMap(8, 0, 0.5, 'solar-wide');          // ~500 pc radius
    await renderNavMap(8, 0, 2, 'solar-region');           // 2 kpc radius
  }

  console.log(`\nOutput: ${OUTPUT_DIR}/`);
}

main();
