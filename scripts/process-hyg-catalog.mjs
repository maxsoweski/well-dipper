#!/usr/bin/env node
/**
 * Process the HYG v4.0 star catalog into a compact JSON file for Well Dipper.
 *
 * Input: data/catalogs/hygdata_v40.csv (119,627 stars)
 * Output: public/assets/data/hyg-stars.json (naked-eye stars with galactic coords)
 *
 * We only keep stars visible to the naked eye (magnitude < 7.0) to keep
 * the file small. These are the "real" stars that override procedural ones.
 *
 * Coordinate conversion: HYG provides equatorial x,y,z in parsecs.
 * We convert to galactic coordinates in kiloparsecs.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

// Read the CSV
const csv = readFileSync('data/catalogs/hygdata_v40.csv', 'utf-8');
const lines = csv.split('\n');
const header = lines[0].replace(/"/g, '').split(',');

// Find column indices
const col = {};
header.forEach((name, i) => { col[name] = i; });

console.log('Columns:', Object.keys(col).join(', '));
console.log('Total rows:', lines.length - 1);

// Solar position in galactic coordinates (kpc from galactic center)
// The HYG x,y,z are heliocentric equatorial in parsecs.
// We need to convert to galactocentric coordinates.
//
// Galactic coordinate conversion:
// The Sun is at R=8.0 kpc from the galactic center, z=0.025 kpc above the plane.
// HYG x,y,z are in parsecs relative to the Sun.
//
// Equatorial to galactic rotation matrix (J2000):
// This rotates from equatorial (x toward vernal equinox, z toward north pole)
// to galactic (x toward galactic center, z toward north galactic pole).
const SOLAR_X = 8.0;  // kpc from galactic center
const SOLAR_Z = 0.025; // kpc above plane

// Rotation matrix: equatorial to galactic (standard IAU)
// From: https://en.wikipedia.org/wiki/Galactic_coordinate_system
const R = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [ 0.4941094279, -0.4448296300,  0.7469822445],
  [-0.8676661490, -0.1980763734,  0.4559837762],
];

function equatorialToGalactic(x_eq, y_eq, z_eq) {
  // Apply rotation matrix
  const x_gal = R[0][0] * x_eq + R[0][1] * y_eq + R[0][2] * z_eq;
  const y_gal = R[1][0] * x_eq + R[1][1] * y_eq + R[1][2] * z_eq;
  const z_gal = R[2][0] * x_eq + R[2][1] * y_eq + R[2][2] * z_eq;
  return { x: x_gal, y: z_gal, z: y_gal }; // y_gal → z in our coords (height above plane)
}

// Process stars
const stars = [];
let nakedEye = 0;
let noDistance = 0;
let processed = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  // Parse CSV (handle quoted fields)
  const fields = line.match(/(".*?"|[^,]*),?/g)?.map(f => f.replace(/^"|"$|,$/g, '').trim()) || [];
  if (fields.length < 10) continue;

  const mag = parseFloat(fields[col['mag']]);
  const absMag = parseFloat(fields[col['absmag']]);
  const dist = parseFloat(fields[col['dist']]); // parsecs
  const spect = fields[col['spect']] || '';
  const proper = fields[col['proper']] || '';
  const bayer = fields[col['bayer']] || '';
  const con = fields[col['con']] || '';
  const x_eq = parseFloat(fields[col['x']]); // parsecs, equatorial
  const y_eq = parseFloat(fields[col['y']]);
  const z_eq = parseFloat(fields[col['z']]);
  const lum = parseFloat(fields[col['lum']]);
  const ci = parseFloat(fields[col['ci']]); // B-V color index

  processed++;

  // Skip stars without distance data
  if (!dist || dist <= 0 || isNaN(dist)) { noDistance++; continue; }
  if (isNaN(x_eq) || isNaN(y_eq) || isNaN(z_eq)) continue;

  // Only keep naked-eye stars (magnitude < 7.0)
  if (isNaN(mag) || mag > 7.0) continue;
  nakedEye++;

  // Convert to galactic coordinates (kpc)
  const galHelio = equatorialToGalactic(x_eq, y_eq, z_eq);
  // Convert from heliocentric parsecs to galactocentric kpc
  const worldX = SOLAR_X + galHelio.x / 1000;
  const worldY = SOLAR_Z + galHelio.y / 1000; // height above plane
  const worldZ = galHelio.z / 1000;

  // Spectral class (first letter)
  const spectClass = spect.charAt(0) || '?';

  // Build name: prefer proper name, then Bayer designation, then HD number
  let name = '';
  if (proper) name = proper;
  else if (bayer && con) name = `${bayer} ${con}`;
  else {
    const hd = fields[col['hd']];
    if (hd) name = `HD ${hd}`;
  }

  stars.push({
    // Position in galactocentric kpc (matching our GalacticMap coordinates)
    x: parseFloat(worldX.toFixed(6)),
    y: parseFloat(worldY.toFixed(6)),
    z: parseFloat(worldZ.toFixed(6)),
    // Properties
    mag: parseFloat(mag.toFixed(2)),
    absMag: parseFloat(absMag.toFixed(2)),
    spect: spectClass,
    ci: isNaN(ci) ? null : parseFloat(ci.toFixed(3)),
    lum: isNaN(lum) ? null : parseFloat(lum.toFixed(2)),
    name: name || null,
    dist: parseFloat((dist / 1000).toFixed(6)), // kpc from Sun
  });
}

console.log(`Processed: ${processed}`);
console.log(`No distance data: ${noDistance}`);
console.log(`Naked-eye (mag < 7.0): ${nakedEye}`);
console.log(`Output stars: ${stars.length}`);

// Sort by magnitude (brightest first)
stars.sort((a, b) => a.mag - b.mag);

// Stats
const spectCounts = {};
for (const s of stars) {
  spectCounts[s.spect] = (spectCounts[s.spect] || 0) + 1;
}
console.log('Spectral type distribution:', spectCounts);
console.log(`Brightest: ${stars[0]?.name} (mag ${stars[0]?.mag})`);
console.log(`Named stars: ${stars.filter(s => s.name).length}`);

// Write output
mkdirSync('public/assets/data', { recursive: true });
const output = JSON.stringify(stars);
writeFileSync('public/assets/data/hyg-stars.json', output);
console.log(`\nWritten: public/assets/data/hyg-stars.json (${(output.length / 1024).toFixed(0)} KB)`);
