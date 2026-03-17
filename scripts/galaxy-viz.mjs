#!/usr/bin/env node
/**
 * galaxy-viz.mjs — Generate visual maps of the Well Dipper galaxy.
 *
 * Usage:
 *   node scripts/galaxy-viz.mjs galaxy          → top-down galaxy overview
 *   node scripts/galaxy-viz.mjs sector 16 0 0   → deep-dive into sector at (16,0,0)
 *   node scripts/galaxy-viz.mjs nearby 8 0 0    → systems near a galactic position
 *
 * Outputs an HTML file you can open in your browser.
 */

import { GalacticMap } from '../src/generation/GalacticMap.js';
import { StarSystemGenerator } from '../src/generation/StarSystemGenerator.js';
import { writeFileSync } from 'fs';

const map = new GalacticMap('well-dipper-galaxy-1');
const [, , mode, ...args] = process.argv;

// ── Color helpers ──
function starColor(type) {
  const colors = {
    O: '#9cb0ff', B: '#aabfff', A: '#cad7ff', F: '#f8f7ff',
    G: '#fff4e8', K: '#ffd2a1', M: '#ffcc6f',
  };
  return colors[type] || '#ffffff';
}

function componentColor(comp) {
  const colors = {
    thin: '#4488ff', thick: '#ff8844', bulge: '#ffcc44', halo: '#8844ff',
  };
  return colors[comp] || '#888888';
}

// ═══════════════════════════════════════════════
// GALAXY OVERVIEW
// ═══════════════════════════════════════════════
function galaxyOverview() {
  const SIZE = 800;
  const RADIUS_KPC = 16;
  const GRID = 120;
  const step = (RADIUS_KPC * 2) / GRID;

  // Sample density across the galactic plane
  const pixels = [];
  let maxDensity = 0;
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const x = -RADIUS_KPC + gx * step;
      const z = -RADIUS_KPC + gy * step;
      const R = Math.sqrt(x * x + z * z);
      if (R > RADIUS_KPC) { pixels.push(0); continue; }

      const densities = map.componentDensities(R, 0);
      const armStr = map.spiralArmStrength(R, Math.atan2(z, x));
      const d = densities.totalDensity * (1 + armStr * 1.5);
      maxDensity = Math.max(maxDensity, d);
      pixels.push(d);
    }
  }

  // Build SVG
  const cellSize = SIZE / GRID;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" style="background:#0a0a12">`;

  // Density heatmap
  for (let gy = 0; gy < GRID; gy++) {
    for (let gx = 0; gx < GRID; gx++) {
      const d = pixels[gy * GRID + gx];
      if (d === 0) continue;
      const norm = Math.pow(d / maxDensity, 0.4); // gamma for visibility
      const r = Math.round(40 + norm * 140);
      const g = Math.round(30 + norm * 120);
      const b = Math.round(80 + norm * 175);
      svg += `<rect x="${gx * cellSize}" y="${gy * cellSize}" width="${cellSize + 0.5}" height="${cellSize + 0.5}" fill="rgb(${r},${g},${b})" />`;
    }
  }

  // Solar position marker
  const solarX = (GalacticMap.SOLAR_R / RADIUS_KPC * 0.5 + 0.5) * SIZE;
  const solarY = SIZE / 2;
  svg += `<circle cx="${solarX}" cy="${solarY}" r="6" fill="none" stroke="#00ff00" stroke-width="2" />`;
  svg += `<text x="${solarX + 10}" y="${solarY + 4}" fill="#00ff00" font-size="12" font-family="monospace">Sol (8 kpc)</text>`;

  // Galactic center marker
  svg += `<circle cx="${SIZE / 2}" cy="${SIZE / 2}" r="4" fill="#ffcc44" />`;
  svg += `<text x="${SIZE / 2 + 8}" y="${SIZE / 2 + 4}" fill="#ffcc44" font-size="11" font-family="monospace">Center</text>`;

  // Scale bar
  svg += `<line x1="20" y1="${SIZE - 30}" x2="${20 + SIZE / (RADIUS_KPC * 2) * 5}" y2="${SIZE - 30}" stroke="#aaa" stroke-width="2" />`;
  svg += `<text x="20" y="${SIZE - 15}" fill="#aaa" font-size="11" font-family="monospace">5 kpc</text>`;

  // Arm labels (approximate positions)
  const armNames = ['Perseus', 'Sagittarius', 'Scutum-Centaurus', 'Norma'];
  for (let i = 0; i < map.armOffsets.length; i++) {
    const angle = map.armOffsets[i] + Math.PI * 0.3; // label partway along arm
    const labelR = 6; // kpc
    const lx = (labelR * Math.cos(angle) / RADIUS_KPC * 0.5 + 0.5) * SIZE;
    const ly = (labelR * Math.sin(angle) / RADIUS_KPC * 0.5 + 0.5) * SIZE;
    svg += `<text x="${lx}" y="${ly}" fill="#6688cc" font-size="10" font-family="monospace" opacity="0.7">${armNames[i] || `Arm ${i}`}</text>`;
  }

  // ── Galactic Features ──
  // Scan the galaxy plane for features and plot them
  const featureColors = {
    'emission-nebula': '#ff3322',
    'dark-nebula': '#332211',
    'open-cluster': '#6688ff',
    'ob-association': '#4466dd',
    'globular-cluster': '#ffaa33',
    'supernova-remnant': '#33dd55',
  };
  const featureSymbols = {
    'emission-nebula': '◎',
    'dark-nebula': '▪',
    'open-cluster': '✦',
    'ob-association': '○',
    'globular-cluster': '●',
    'supernova-remnant': '✸',
  };

  console.log('Scanning for galactic features...');
  const allFeatures = [];
  const seenSeeds = new Set();
  for (let r = 0.5; r <= RADIUS_KPC - 0.5; r += 0.8) {
    for (let theta = 0; theta < Math.PI * 2; theta += 0.15) {
      const x = r * Math.cos(theta);
      const z = r * Math.sin(theta);
      const found = map.findNearbyFeatures({ x, y: 0, z }, 4.0);
      for (const f of found) {
        if (!seenSeeds.has(f.seed)) {
          seenSeeds.add(f.seed);
          allFeatures.push(f);
        }
      }
    }
  }
  console.log(`Found ${allFeatures.length} unique features`);

  // Plot features
  for (const f of allFeatures) {
    const fx = (f.position.x / RADIUS_KPC * 0.5 + 0.5) * SIZE;
    const fy = (f.position.z / RADIUS_KPC * 0.5 + 0.5) * SIZE;
    const fr = Math.max(2, f.radius / RADIUS_KPC * 0.5 * SIZE);
    const color = featureColors[f.type] || '#888';

    // Feature circle (radius)
    svg += `<circle cx="${fx}" cy="${fy}" r="${fr}" fill="${color}" opacity="0.25" stroke="${color}" stroke-width="0.5" />`;
    // Center dot
    svg += `<circle cx="${fx}" cy="${fy}" r="1.5" fill="${color}" opacity="0.8" />`;
  }

  // Feature legend
  let legendY = SIZE - 120;
  svg += `<text x="20" y="${legendY}" fill="#ccc" font-size="11" font-family="monospace" font-weight="bold">Features (${allFeatures.length})</text>`;
  legendY += 14;
  const typeCounts = {};
  for (const f of allFeatures) typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    const color = featureColors[type] || '#888';
    svg += `<circle cx="28" cy="${legendY - 3}" r="4" fill="${color}" opacity="0.6" />`;
    svg += `<text x="38" y="${legendY}" fill="#aaa" font-size="10" font-family="monospace">${type} (${count})</text>`;
    legendY += 13;
  }

  // Title
  svg += `<text x="20" y="25" fill="#fff" font-size="16" font-family="monospace" font-weight="bold">Well Dipper Galaxy — Top-Down View</text>`;
  svg += `<text x="20" y="42" fill="#888" font-size="11" font-family="monospace">Seed: well-dipper-galaxy-1 | ${RADIUS_KPC} kpc radius | ${allFeatures.length} galactic features</text>`;

  svg += '</svg>';

  // Wrap in HTML
  const html = `<!DOCTYPE html><html><head><title>Well Dipper Galaxy</title>
<style>body{margin:0;background:#000;display:flex;justify-content:center;align-items:center;min-height:100vh;}</style>
</head><body>${svg}</body></html>`;

  const outPath = 'galaxy-overview.html';
  writeFileSync(outPath, html);
  console.log(`Galaxy overview saved to ${outPath}`);
  console.log(`Open in browser: file://${process.cwd()}/${outPath}`);
}

// ═══════════════════════════════════════════════
// SECTOR DEEP-DIVE
// ═══════════════════════════════════════════════
function sectorView(sx, sy, sz) {
  const sectorKey = `${sx},${sy},${sz}`;
  const sector = map.getSector(sx, sy, sz);
  const context = map.deriveGalaxyContext({
    x: sx * GalacticMap.SECTOR_SIZE,
    y: sy * GalacticMap.SECTOR_SIZE,
    z: sz * GalacticMap.SECTOR_SIZE,
  });

  console.log(`\nSector ${sectorKey}: ${sector.stars.length} stars`);
  console.log(`Component: ${context.component}, Metallicity: ${context.metallicity.toFixed(2)}, Age: ${context.age.toFixed(1)} Gyr`);
  console.log(`Arm strength: ${context.spiralArmStrength.toFixed(2)}`);

  const SIZE = 900;
  const SECTOR_SIZE = GalacticMap.SECTOR_SIZE;

  // Generate systems for each star
  const systems = [];
  for (const star of sector.stars) {
    const ctx = map.deriveGalaxyContext({ x: star.worldX, y: star.worldY, z: star.worldZ });
    const sys = StarSystemGenerator.generate(star.seed, ctx);
    systems.push({ star, ctx, sys });
  }

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE + 300}" style="background:#0a0a12">`;

  // Title and sector info
  svg += `<text x="20" y="25" fill="#fff" font-size="16" font-family="monospace" font-weight="bold">Sector ${sectorKey} — Deep Dive</text>`;
  svg += `<text x="20" y="42" fill="#888" font-size="11" font-family="monospace">`;
  svg += `Component: ${context.component} | [Fe/H]: ${context.metallicity.toFixed(2)} | Age: ${context.age.toFixed(1)} Gyr | Arm: ${(context.spiralArmStrength * 100).toFixed(0)}% | Stars: ${sector.stars.length}`;
  svg += `</text>`;

  // Plot stars in the sector (top-down: X vs Z)
  const mapOffset = 60;
  const mapSize = SIZE - 120;

  // Grid
  svg += `<rect x="${mapOffset}" y="${mapOffset}" width="${mapSize}" height="${mapSize}" fill="none" stroke="#222" stroke-width="1" />`;
  for (let g = 0.25; g < 1; g += 0.25) {
    const gp = mapOffset + g * mapSize;
    svg += `<line x1="${mapOffset}" y1="${gp}" x2="${mapOffset + mapSize}" y2="${gp}" stroke="#181828" />`;
    svg += `<line x1="${gp}" y1="${mapOffset}" x2="${gp}" y2="${mapOffset + mapSize}" stroke="#181828" />`;
  }

  // Stars
  for (let i = 0; i < systems.length; i++) {
    const { star, sys } = systems[i];
    const localX = (star.localX / SECTOR_SIZE) * mapSize + mapOffset;
    const localZ = (star.localZ / SECTOR_SIZE) * mapSize + mapOffset;

    const color = starColor(sys.star.type);
    const r = 3 + sys.star.radiusSolar * 2;

    // Star dot
    svg += `<circle cx="${localX}" cy="${localZ}" r="${r}" fill="${color}" opacity="0.9" />`;

    // Label
    const label = `${sys.star.type}${sys.isBinary ? '+' + sys.star2.type : ''} (${sys.planets.length}p)`;
    svg += `<text x="${localX + r + 3}" y="${localZ + 3}" fill="${color}" font-size="9" font-family="monospace">${label}</text>`;

    // Highlight notable features
    const notables = [];
    if (sys.stellarEvolution.evolved) notables.push(`⚡${sys.stellarEvolution.stage}`);
    if (sys.migrationHistory.occurred) notables.push('🔀migrated');
    if (sys.resonanceChain) notables.push('🔗resonant');

    for (const p of sys.planets) {
      if (p.planetData.type === 'terrestrial') notables.push('🌍terrestrial');
      if (p.planetData.type === 'ocean') notables.push('🌊ocean');
      if (p.planetData.habitability?.score > 0.7) notables.push(`hab:${p.planetData.habitability.score.toFixed(1)}`);
    }
    if (sys.trojanClusters.length > 0) notables.push(`${sys.trojanClusters.length}×trojan`);

    if (notables.length > 0) {
      svg += `<text x="${localX + r + 3}" y="${localZ + 14}" fill="#aaa" font-size="8" font-family="monospace">${notables.join(' ')}</text>`;
    }
  }

  // Axis labels
  svg += `<text x="${mapOffset}" y="${mapOffset - 5}" fill="#666" font-size="10" font-family="monospace">X →</text>`;
  svg += `<text x="${mapOffset - 15}" y="${mapOffset + 15}" fill="#666" font-size="10" font-family="monospace" transform="rotate(-90, ${mapOffset - 15}, ${mapOffset + 15})">Z →</text>`;

  // ── Detail table below map ──
  let tableY = mapSize + mapOffset + 40;
  svg += `<text x="20" y="${tableY}" fill="#fff" font-size="13" font-family="monospace" font-weight="bold">System Details</text>`;
  tableY += 20;

  const headers = ['#', 'Star', 'Binary', 'Planets', 'Archetype', '[Fe/H]', 'Age(Gyr)', 'Evolution', 'Notable'];
  const colX = [20, 50, 110, 165, 240, 340, 410, 480, 590];
  for (let h = 0; h < headers.length; h++) {
    svg += `<text x="${colX[h]}" y="${tableY}" fill="#888" font-size="9" font-family="monospace">${headers[h]}</text>`;
  }
  tableY += 5;
  svg += `<line x1="20" y1="${tableY}" x2="${SIZE - 20}" y2="${tableY}" stroke="#333" />`;
  tableY += 12;

  for (let i = 0; i < systems.length; i++) {
    const { sys } = systems[i];
    const notables = [];
    const habPlanets = sys.planets.filter(p => ['terrestrial', 'ocean', 'eyeball'].includes(p.planetData.type));
    if (habPlanets.length) notables.push(`${habPlanets.length} habitable`);
    if (sys.migrationHistory.occurred) notables.push('migration');
    if (sys.resonanceChain) notables.push('resonant');
    if (sys.trojanClusters.length) notables.push(`${sys.trojanClusters.length} trojans`);
    const belts = sys.asteroidBelts.filter(b => b.physics?.type === 'main').length;
    const kuiper = sys.asteroidBelts.filter(b => b.physics?.type === 'kuiper').length;
    if (belts) notables.push(`${belts} belt`);
    if (kuiper) notables.push('kuiper');

    const row = [
      `${i + 1}`,
      sys.star.type,
      sys.isBinary ? sys.star2.type : '—',
      `${sys.planets.length}`,
      sys.archetype,
      sys.metallicity.toFixed(2),
      sys.ageGyr.toFixed(1),
      sys.stellarEvolution.stage,
      notables.join(', ') || '—',
    ];
    const color = starColor(sys.star.type);
    for (let c = 0; c < row.length; c++) {
      svg += `<text x="${colX[c]}" y="${tableY}" fill="${c === 1 ? color : '#ccc'}" font-size="9" font-family="monospace">${row[c]}</text>`;
    }
    tableY += 14;
  }

  svg += '</svg>';

  const html = `<!DOCTYPE html><html><head><title>Sector ${sectorKey}</title>
<style>body{margin:0;background:#000;display:flex;justify-content:center;padding:20px 0;}</style>
</head><body>${svg}</body></html>`;

  const outPath = `sector-${sx}-${sy}-${sz}.html`;
  writeFileSync(outPath, html);
  console.log(`Sector view saved to ${outPath}`);
  console.log(`Open in browser: file://${process.cwd()}/${outPath}`);
}

// ═══════════════════════════════════════════════
// DISPATCH
// ═══════════════════════════════════════════════
switch (mode) {
  case 'galaxy':
    galaxyOverview();
    break;
  case 'sector':
    sectorView(
      parseInt(args[0] || '16'), // default: solar neighborhood
      parseInt(args[1] || '0'),
      parseInt(args[2] || '0'),
    );
    break;
  default:
    console.log('Usage:');
    console.log('  node scripts/galaxy-viz.mjs galaxy              — galaxy overview');
    console.log('  node scripts/galaxy-viz.mjs sector 16 0 0       — sector deep-dive');
}
