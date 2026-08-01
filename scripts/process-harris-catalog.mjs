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
 *
 * Part I supplies identifications + positions. Part III supplies the King-model
 * structural parameters (concentration c, core radius r_c, half-light radius r_h
 * in arcmin) that give each cluster a REAL physical radius instead of a uniform
 * placeholder (AC6 / design D5, real-universe-overlay-2026-07-12). We join Part
 * III to Part I by ID and emit a per-cluster tidal radius r_t = r_c·10^c,
 * converted at the cluster's own Sun distance (the "visible ball" the renderer
 * draws; r_h under-represents it).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const raw = readFileSync('data/catalogs/harris_globular_clusters.dat', 'utf-8');
const lines = raw.split('\n');

// Small-angle arcmin → radian (1' = π/10800 rad). r_pc = θ_arcmin · this · d_pc,
// so radiusKpc = θ_arcmin · this · rSun_kpc (design D5, fact 10).
const ARCMIN_TO_RAD = 2.90888e-4;

// ── Part III: King-model structural parameters, parsed by fixed column ─────────
// The velocity columns (v_r … sig_v) are frequently blank, so token splitting is
// unreliable; c/r_c/r_h sit in fixed character columns (verified against the .dat):
//   c   line[49:54]   |  core-collapse flag line[54:58] ('c'/'c:')
//   r_c line[58:64]   |  r_h line[64:70]
// Blank fields parse to NaN and are treated as absent.
const structByFmId = new Map(); // Part-III ID (formatted, e.g. 'NGC 104') → params
{
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s+ID\s+v_r\b/.test(lines[i])) { start = i + 1; break; } // the Part III header
  }
  for (let i = start; i >= 0 && i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const id = line.slice(0, 12).trim();
    if (!id) continue;
    const c = parseFloat(line.slice(49, 54));
    const coreCollapsed = /c/.test(line.slice(54, 58));
    const rC = parseFloat(line.slice(58, 64));
    const rH = parseFloat(line.slice(64, 70));
    structByFmId.set(id, {
      c: Number.isFinite(c) ? c : null,
      rC: Number.isFinite(rC) ? rC : null,
      rH: Number.isFinite(rH) ? rH : null,
      coreCollapsed,
    });
  }
}

/**
 * Physical cluster radius (kpc) from Part III structural params, at distance
 * rSun (kpc). Preference order (design D5 / fact 10):
 *   'tidal'  — c AND r_c present → tidal radius r_t = r_c·10^c
 *   'rhalf'  — only r_h present  → fallback r_t ≈ 4·r_h
 *   'placeholder' — neither      → keep the historical 30 pc default
 */
function deriveRadius(struct, rSun) {
  if (struct && struct.c != null && struct.rC != null) {
    const rTidalArcmin = struct.rC * Math.pow(10, struct.c);
    return { radiusKpc: rTidalArcmin * ARCMIN_TO_RAD * rSun, method: 'tidal' };
  }
  if (struct && struct.rH != null) {
    const rTidalArcmin = 4 * struct.rH;
    return { radiusKpc: rTidalArcmin * ARCMIN_TO_RAD * rSun, method: 'rhalf' };
  }
  return { radiusKpc: 0.03, method: 'placeholder' };
}

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

  // Join Part III structural parameters by ID → real physical radius.
  const struct = structByFmId.get(id);
  const { radiusKpc, method } = deriveRadius(struct, rSun);
  const rH = struct?.rH ?? null;

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
    // AC6/D5 structural parameters (join from Harris Part III).
    radiusKpc: parseFloat(radiusKpc.toFixed(5)),
    rHalfPc: rH != null ? parseFloat((rH * ARCMIN_TO_RAD * rSun * 1000).toFixed(3)) : null,
    concentration: struct?.c ?? null,
    coreCollapsed: struct?.coreCollapsed ?? false,
    radiusMethod: method,
  });
}

console.log(`Parsed ${clusters.length} globular clusters`);
console.log('First 5:', clusters.slice(0, 5).map(c => `${c.name} at (${c.x}, ${c.y}, ${c.z})`));
console.log('Furthest:', clusters.reduce((a, b) => a.rSun > b.rSun ? a : b).name,
  'at', clusters.reduce((a, b) => a.rSun > b.rSun ? a : b).rSun, 'kpc');

const methodCounts = clusters.reduce((a, c) => { a[c.radiusMethod] = (a[c.radiusMethod] || 0) + 1; return a; }, {});
console.log('Radius derivation methods:', methodCounts);
const radiiPc = clusters.map(c => c.radiusKpc * 1000);
console.log(`Radius range: ${Math.min(...radiiPc).toFixed(1)}–${Math.max(...radiiPc).toFixed(1)} pc (was uniform 30 pc)`);

mkdirSync('public/assets/data', { recursive: true });
const output = JSON.stringify(clusters, null, 2);
writeFileSync('public/assets/data/globular-clusters.json', output);
console.log(`Written: public/assets/data/globular-clusters.json (${(output.length / 1024).toFixed(0)} KB)`);
