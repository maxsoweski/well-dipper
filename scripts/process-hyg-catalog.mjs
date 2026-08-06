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

// Proper RFC4180-style CSV line parser. The previous regex-based splitter
// mishandled consecutive quoted-empty fields (e.g. `"","","",`), leaving a
// stray `"` character in a field instead of an empty string — which then
// looked "truthy" to the name-building logic below and produced bogus
// star names that were literally the `"` character. This state machine
// walks the line character by character so quote/comma boundaries are
// tracked correctly regardless of how many empty quoted fields are adjacent.
function parseCSVLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } // escaped quote
        else { inQuotes = false; }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields.map(f => f.trim());
}

// ── Catalog dedup: collapse duplicate destinations to ONE row + aliases ──────
// (real-star-identity-unification-2026-07-15, FIX-4). Two kinds of duplicate
// destination are collapsed so nav/prism/sky render ONE marker per real system
// and every real designation stays a searchable alias:
//   (a) SAME-POSITION duplicate-name rows — one physical star the HYG catalog
//       carries twice (a proper-name row + a Bayer-designation row) at an
//       identical rounded position. Kept: the proper-named row; the Bayer name
//       becomes an alias.
//   (b) TABLE-COVERED multiple secondaries — a bound companion the curated
//       companion table (stellarCompanions.js) represents INSIDE the primary's
//       system (Sirius B / Proxima precedent: companions live in the system, not
//       as their own catalog row). The secondary row drops to an alias of the
//       primary — so Alpha Centauri (Rigil + Toliman), 36 Ophiuchi (Guniibuu +
//       HD 155886 + HD 156026), 61 Cygni and ζ Reticuli each render ONE marker.
// Every dropped name is retained in `aliases[]` on its primary row, which keeps
// it BOTH searchable (knownObjectSearch scans aliases; KnownSystems.associate
// folds a claimed row's aliases into the registry entry so Toliman → Alpha
// Centauri) AND blocklisted (gen-real-proper-names reads aliases).
//
// γ Leporis + HD 38392 (0.042 pc) is DELIBERATELY left as two systems: a
// genuinely wide pair straddling separate F1 seed cells, acceptable as two
// destinations (far-companion representation is available later if wanted).
const DEDUP = [
  // (a) same-position duplicate-name rows (identical rounded position — one
  //     star, two catalog names). `samePosition` is asserted below.
  { drop: 'Xi UMa',    into: 'Alula Australis', samePosition: true }, // ξ UMa ≡ Alula Australis
  { drop: 'Xi Sco',    into: 'Graffias',        samePosition: true }, // ξ Sco historically "Graffias"
  // (b) table-covered multiple secondaries → the system's primary catalog row.
  { drop: 'Toliman',   into: 'Rigil Kentaurus' }, // α Cen B → α Cen A (Alpha Centauri)
  { drop: 'HD 155886', into: 'Guniibuu' },        // 36 Oph B → 36 Oph A (Guniibuu)
  { drop: 'HD 156026', into: 'Guniibuu' },        // 36 Oph C → 36 Oph A (Guniibuu)
  { drop: 'HD 201092', into: 'HD 201091' },       // 61 Cyg B → 61 Cyg A
  { drop: 'Zet-2 Ret', into: 'Zet-1 Ret' },       // ζ² Ret → ζ¹ Ret
];

const POS_EPS = 1e-6; // kpc — exact same-rounded-position tolerance for (a)

function findExactlyOneRow(rows, name) {
  const matches = rows.filter((s) => s.name === name);
  if (matches.length !== 1) {
    throw new Error(`[dedup] expected exactly ONE row named ${JSON.stringify(name)}, found ${matches.length}`);
  }
  return matches[0];
}

// Apply DEDUP in place: attach aliases to primaries, return the kept rows +
// an accounting of what dropped. Deterministic (fixed DEDUP order → fixed alias
// order), so a fresh regen is byte-identical.
function applyCatalogDedup(rows) {
  const dropped = new Set();
  const accounting = [];
  for (const rule of DEDUP) {
    const primary = findExactlyOneRow(rows, rule.into);
    const secondary = findExactlyOneRow(rows, rule.drop);
    if (rule.samePosition) {
      const d = Math.hypot(primary.x - secondary.x, primary.y - secondary.y, primary.z - secondary.z);
      if (d > POS_EPS) {
        throw new Error(`[dedup] ${rule.drop} → ${rule.into} tagged samePosition but are ${d} kpc apart`);
      }
    }
    (primary.aliases ??= []).push(rule.drop);
    dropped.add(secondary);
    accounting.push({ drop: rule.drop, into: rule.into, kind: rule.samePosition ? 'same-position' : 'table-secondary' });
  }
  const kept = rows.filter((s) => !dropped.has(s));

  // Invariant: after dedup NO two kept rows share an exact rounded position —
  // one destination per position (the finding-#1 "two markers at one spot"
  // defect). A future HYG update that introduces a new exact duplicate trips
  // this instead of silently shipping twin markers.
  const seen = new Map();
  for (const s of kept) {
    const key = `${s.x},${s.y},${s.z}`;
    if (seen.has(key)) {
      throw new Error(`[dedup] unhandled same-position duplicate after dedup: "${seen.get(key)}" and "${s.name}" at ${key}`);
    }
    seen.set(key, s.name);
  }
  return { kept, accounting };
}

// Process stars
const stars = [];
let nakedEye = 0;
let noDistance = 0;
let processed = 0;

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const fields = parseCSVLine(line);
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

// The Sun: HYG row id=0 is "Sol" with dist=0 (it IS the heliocentric origin),
// which the distance filter above rejects — correctly for every other star,
// wrongly for Sol. Emit it explicitly at the game's registered solar position
// so the catalog carries Sol's identity: the nav computer's real-star overlay
// names the home system from it, the sky renders it from neighboring systems,
// and it must agree with the KnownSystems registry entry (same name, same
// position — see KnownSystems.match-radius.test.js). Values mirror HYG row 0.
stars.push({
  x: SOLAR_X, y: SOLAR_Z, z: 0.0,
  mag: -26.74, absMag: 4.83,
  spect: 'G', ci: 0.656, lum: 1,
  name: 'Sol', dist: 0,
});

// Collapse duplicate destinations (see DEDUP above) BEFORE counting/sorting.
const beforeDedup = stars.length;
const { kept, accounting } = applyCatalogDedup(stars);
stars.length = 0;
stars.push(...kept);

console.log(`Processed: ${processed}`);
console.log(`No distance data: ${noDistance}`);
console.log(`Naked-eye (mag < 7.0): ${nakedEye}`);
console.log(`Dedup: ${beforeDedup} → ${stars.length} rows (${accounting.length} secondary rows dropped to aliases):`);
for (const a of accounting) console.log(`  - ${a.drop} → ${a.into} (${a.kind})`);
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
