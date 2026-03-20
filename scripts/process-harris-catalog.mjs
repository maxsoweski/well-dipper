#!/usr/bin/env node
/**
 * Process the Harris (2010) globular cluster catalog into JSON.
 *
 * Input: data/catalogs/harris_globular_clusters.dat
 * Output: public/assets/data/globular-clusters.json
 *
 * Harris catalog provides X,Y,Z in galactocentric kpc (Sun at X=8.0).
 * We map: Harris X → our x (toward galactic center)
 *         Harris Y → our z
 *         Harris Z → our y (height above plane)
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const raw = readFileSync('data/catalogs/harris_globular_clusters.dat', 'utf-8');
const lines = raw.split('\n');

const clusters = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  // Match lines that start with a cluster ID (NGC, Pal, AM, etc.)
  // Format: " NGC 104    47 Tuc       00 24 05.67  -72 04 52.6   305.89  -44.89    4.5   7.4   1.9  -2.6  -3.1"
  // The X, Y, Z values are at the end in galactocentric kpc
  const match = line.match(/^\s+([\w\s]+?)\s{2,}([\w\s]*?)\s{2,}\d{2}\s+\d{2}\s+[\d.]+\s+[+-]?\d{2}\s+\d{2}\s+[\d.]+\s+([\d.]+)\s+([+-]?[\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)\s+([+-]?[\d.]+)/);

  if (!match) continue;

  const id = match[1].trim();
  const altName = match[2].trim();
  const l = parseFloat(match[3]);
  const b = parseFloat(match[4]);
  const rSun = parseFloat(match[5]);
  const rGc = parseFloat(match[6]);
  const harrisX = parseFloat(match[7]); // toward galactic center from Sun
  const harrisY = parseFloat(match[8]); // in galactic plane, perpendicular
  const harrisZ = parseFloat(match[9]); // height above plane

  // Convert Harris coordinates to our system.
  // Harris uses: X = toward galactic center from Sun, Y = in disk plane, Z = above plane
  // Harris states X,Y,Z are "with respect to the Sun" in some versions
  // but the header says R_gc column = distance from galactic center.
  // Let's use the galactocentric interpretation:
  // Our system: x,z are in the disk plane, y is height above plane.
  // Galactic center is at (0,0,0) in our system.
  // Harris X is "toward" the GC, Y is perpendicular in the plane, Z is above.
  // But we need to figure out the exact mapping.
  //
  // Looking at NGC 104 (47 Tuc): R_sun=4.5, R_gc=7.4, X=1.9, Y=-2.6, Z=-3.1
  // That means X²+Y²+Z² should ≈ R_sun² if heliocentric: 1.9²+2.6²+3.1² = 3.6+6.8+9.6 = 20 → √20 = 4.5 ✓
  // So X,Y,Z are HELIOCENTRIC in kpc.
  //
  // Convert heliocentric to galactocentric:
  // Sun is at galactocentric (8, 0, 0.025) in our system.
  // Harris X points toward galactic center → our -x direction
  // Harris Y points in the plane perpendicular → our z direction
  // Harris Z points above plane → our y direction

  const worldX = 8.0 - harrisX; // Sun at 8 kpc, X toward center = subtract
  const worldY = 0.025 + harrisZ; // height above plane
  const worldZ = harrisY; // perpendicular in disk plane

  const name = altName || id;

  clusters.push({
    id,
    name,
    x: parseFloat(worldX.toFixed(3)),
    y: parseFloat(worldY.toFixed(3)),
    z: parseFloat(worldZ.toFixed(3)),
    rSun: rSun,
    rGc: rGc,
    l: l,
    b: b,
  });
}

console.log(`Parsed ${clusters.length} globular clusters`);
console.log('First 5:', clusters.slice(0, 5).map(c => `${c.name} at (${c.x}, ${c.y}, ${c.z})`));
console.log('Furthest:', clusters.reduce((a, b) => a.rSun > b.rSun ? a : b).name,
  'at', clusters.reduce((a, b) => a.rSun > b.rSun ? a : b).rSun, 'kpc');

mkdirSync('public/assets/data', { recursive: true });
const output = JSON.stringify(clusters, null, 2);
writeFileSync('public/assets/data/globular-clusters.json', output);
console.log(`Written: public/assets/data/globular-clusters.json (${(output.length / 1024).toFixed(0)} KB)`);
