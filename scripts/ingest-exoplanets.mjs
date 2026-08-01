#!/usr/bin/env node
/**
 * scripts/ingest-exoplanets.mjs
 *
 * Build-time ingest of the NASA Exoplanet Archive into the two data files the
 * real-universe overlay consumes. Increment 1 (AC7) of
 * docs/WORKSTREAMS/real-universe-overlay-2026-07-12/. Build-time DATA DELIVERY
 * ONLY — no engine/runtime wiring here.
 *
 * WHAT IT DOES (two modes, HYG-pattern: raw committed, processing pure):
 *   node scripts/ingest-exoplanets.mjs --fetch
 *       TAP query -> data/catalogs/pscomppars-raw.json  (committed snapshot, ~3 MB)
 *   node scripts/ingest-exoplanets.mjs            (default = process, needs raw)
 *       raw -> public/assets/data/real-system-contents.json  (hosts + planets)
 *            + public/assets/data/real-star-supplement.json  (dim famous hosts
 *              as NEW real catalog stars at true galactocentric positions)
 *
 * INTENT: give downstream ACs (overlay merge, nav, search) a re-runnable,
 * deterministic, byte-identical source of confirmed exoplanet systems + a handful
 * of famous below-naked-eye host stars, with build-time verification of exactly
 * the fields those ACs consume. Positions reuse process-hyg-catalog.mjs's exact
 * equatorial->galactic rotation + axis swap + solar offset — the CONVERSION is
 * identical, but the archive's sy_dist frequently DISAGREES with HYG's distance
 * for the same physical star (measured 2026-07-12: 116 hosts share an exact hyg
 * name, 104 of them land beyond POSITION_MATCH_TOL from that hyg star — median
 * ~0.8 pc, max ~28 pc). Increment-3's overlay merge must therefore join by NAME
 * first (or adopt the hyg position on a confident name match); a bare position
 * join would miss most bright archive hosts. The per-run report prints the
 * cross-ref stats so drift stays visible.
 *
 * DELIBERATE NON-GOALS: no RealStarCatalog/StarSystemGenerator wiring; no overlay
 * merge; no UI; no bulk double-star ingest (multiplicity lives in the curated
 * companion table, a separate deliverable); no namedSystemsCatalog regen ITSELF
 * (this script only DETECTS a collision and reports it — regenerating
 * namedSystemsCatalog.js via gen-named-systems.mjs under the enlarged blocklist
 * is in-scope remediation the coordinator/main session applies, per design §4).
 * This script only writes the two data files + the raw snapshot, and hard-fails
 * the build on any self-check violation.
 *
 * DETERMINISM: pure function of the committed raw JSON. No Date, no randomness, no
 * timestamps in any output. Hosts sorted by name (code-point), planets by letter
 * (code-point). Re-running process yields byte-identical files (proven in-memory
 * here and by re-running the script + sha256sum).
 *
 * Source & license (embedded in both outputs, no timestamps):
 *   NASA Exoplanet Archive, pscomppars (Planetary Systems Composite Parameters).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { KnownSystems } from '../src/generation/KnownSystems.js';
import { getNamedSystemsMap } from '../src/generation/data/namedSystemsCatalog.js';
import { STELLAR_COMPANIONS } from '../src/generation/data/stellarCompanions.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const RAW_PATH = join(ROOT, 'data/catalogs/pscomppars-raw.json');
const CONTENTS_PATH = join(ROOT, 'public/assets/data/real-system-contents.json');
const SUPPLEMENT_PATH = join(ROOT, 'public/assets/data/real-star-supplement.json');
const HYG_PATH = join(ROOT, 'public/assets/data/hyg-stars.json');

// ---------------------------------------------------------------------------
// Source / license strings embedded verbatim in the outputs (no timestamps).
// ---------------------------------------------------------------------------
const LICENSE =
  'This research has made use of the NASA Exoplanet Archive, which is operated ' +
  'by the California Institute of Technology, under contract with the National ' +
  'Aeronautics and Space Administration under the Exoplanet Exploration Program.';
const SOURCE =
  'NASA Exoplanet Archive — pscomppars (Planetary Systems Composite Parameters, ' +
  'one row per confirmed planet), retrieved via TAP sync from ' +
  'https://exoplanetarchive.ipac.caltech.edu/TAP/';

// ---------------------------------------------------------------------------
// TAP query (fetch mode). order by pl_name = a total, stable order.
// ---------------------------------------------------------------------------
const TAP_URL = 'https://exoplanetarchive.ipac.caltech.edu/TAP/sync';
const TAP_COLUMNS = [
  'hostname', 'pl_letter', 'pl_name', 'ra', 'dec', 'sy_dist', 'sy_snum',
  'sy_pnum', 'sy_vmag', 'st_spectype', 'st_teff', 'st_lum', 'st_rad', 'st_mass',
  'pl_orbper', 'pl_orbsmax', 'pl_bmasse', 'pl_rade', 'pl_orbeccen',
].join(', ');
const TAP_QUERY = `select ${TAP_COLUMNS} from pscomppars order by pl_name`;

// ---------------------------------------------------------------------------
// Coordinate conversion — MUST match scripts/process-hyg-catalog.mjs EXACTLY
// (rotation matrix, SOLAR_X/SOLAR_Z, and the {x:x_gal, y:z_gal, z:y_gal} axis
// swap) so overlay-merge position joins (Increment 3) line up with hyg-stars.json.
// ---------------------------------------------------------------------------
const SOLAR_X = 8.0;   // kpc from galactic center
const SOLAR_Z = 0.025; // kpc above plane
const R = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [ 0.4941094279, -0.4448296300,  0.7469822445],
  [-0.8676661490, -0.1980763734,  0.4559837762],
];
function equatorialToGalactic(x_eq, y_eq, z_eq) {
  const x_gal = R[0][0] * x_eq + R[0][1] * y_eq + R[0][2] * z_eq;
  const y_gal = R[1][0] * x_eq + R[1][1] * y_eq + R[1][2] * z_eq;
  const z_gal = R[2][0] * x_eq + R[2][1] * y_eq + R[2][2] * z_eq;
  return { x: x_gal, y: z_gal, z: y_gal }; // y_gal -> z (height above plane) swap
}
// ra/dec (deg) + dist (pc) -> equatorial cartesian (pc) -> galactocentric kpc.
function galacticPosition(ra, dec, distPc) {
  const rr = (ra * Math.PI) / 180;
  const dr = (dec * Math.PI) / 180;
  const x_eq = distPc * Math.cos(dr) * Math.cos(rr);
  const y_eq = distPc * Math.cos(dr) * Math.sin(rr);
  const z_eq = distPc * Math.sin(dr);
  const g = equatorialToGalactic(x_eq, y_eq, z_eq);
  return {
    x: round6(SOLAR_X + g.x / 1000),
    y: round6(SOLAR_Z + g.y / 1000),
    z: round6(g.z / 1000),
  };
}

const round6 = (v) => parseFloat(v.toFixed(6));
const round2 = (v) => parseFloat(v.toFixed(2));
// Code-point string comparator — deterministic across every locale/environment
// (localeCompare is NOT guaranteed byte-stable across ICU builds).
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------------------
// Spectral-class derivation (design §1): first char of st_spectype when it is a
// recognized class letter, else Teff bins.
// ---------------------------------------------------------------------------
const SPECT_LETTERS = new Set(
  ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'L', 'T', 'Y', 'D', 'W', 'C', 'S'],
);
function spectralClass(spectFull, teff) {
  if (spectFull) {
    const c = spectFull.trim().charAt(0);
    if (SPECT_LETTERS.has(c)) return c;
  }
  if (teff != null) {
    if (teff >= 30000) return 'O';
    if (teff >= 10000) return 'B';
    if (teff >= 7500) return 'A';
    if (teff >= 6000) return 'F';
    if (teff >= 5200) return 'G';
    if (teff >= 3700) return 'K';
    if (teff >= 2400) return 'M';
    return 'M';
  }
  return null; // caught by "every host position+spect present" self-check
}

// ---------------------------------------------------------------------------
// Tolerances (kpc). Names/values mirror the engine so downstream stays coherent.
// ---------------------------------------------------------------------------
const POSITION_MATCH_TOL = 0.0001; // no two ingested hosts closer than this
const MATCH_RADIUS = 0.0005;       // supplement clearance vs hyg-stars + KnownSystems

// ---------------------------------------------------------------------------
// Curated dim famous hosts (design §2). Archive hostnames — verified present in
// the live archive at build time (script errors if any is missing). Positions &
// params come from the archive, NEVER hand-typed.
//
// NOTE: the design originally named "Kepler-90", which does NOT exist in
// pscomppars — the archive carries that system only as hostname "KOI-351"
// (verified: 0 rows for Kepler-90, 8 rows for KOI-351). Post-build ruling
// (2026-07-12): ingest it as KOI-351 with a "Kepler-90" display-name override —
// the same mechanism Proxima Cen / Barnard's star already use (players know
// the famous 8-planet system as Kepler-90; the hostname field preserves the
// archive form for exact data joins).
// ---------------------------------------------------------------------------
const CURATED_DIM_HOSTS = [
  'Proxima Cen',
  'TRAPPIST-1',
  "Barnard's star",
  'Ross 128',
  'Wolf 1061',
  'GJ 273',       // Luyten's Star
  'YZ Cet',
  "Teegarden's Star",
  'GJ 1002',
  'GJ 1214',
  'LHS 1140',
  'KOI-351',      // Kepler-90 (archive carries only the KOI hostname)
  'Kepler-186',
  'Kepler-452',
];
// Player-recognizable display names (design §2); everything else uses the exact
// archive hostname. hostname field on each entry always keeps the archive form.
const DISPLAY_NAME_OVERRIDES = {
  'Proxima Cen': 'Proxima Centauri',
  "Barnard's star": "Barnard's Star",
  'KOI-351': 'Kepler-90',
};

// ===========================================================================
// FETCH MODE
// ===========================================================================
async function runFetch() {
  console.log('[ingest] fetch: querying NASA Exoplanet Archive TAP…');
  const body = new URLSearchParams({ query: TAP_QUERY, format: 'json' });
  const res = await fetch(TAP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    console.error(`[ingest] fetch FAILED: HTTP ${res.status} ${res.statusText}`);
    console.error(await res.text().catch(() => ''));
    process.exit(1);
  }
  const text = await res.text();
  let rows;
  try {
    rows = JSON.parse(text);
  } catch (e) {
    console.error('[ingest] fetch FAILED: response was not JSON:', e.message);
    console.error(text.slice(0, 500));
    process.exit(1);
  }
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('[ingest] fetch FAILED: empty / non-array result.');
    process.exit(1);
  }
  mkdirSync(dirname(RAW_PATH), { recursive: true });
  // Re-serialize (parse->pretty) for a clean, diffable committed snapshot.
  writeFileSync(RAW_PATH, JSON.stringify(rows, null, 2) + '\n');
  console.log(`[ingest] fetch: wrote ${RAW_PATH} (${rows.length} rows, ${sizeKB(RAW_PATH)} KB)`);
}

// ===========================================================================
// PROCESS MODE (pure/deterministic)
// ===========================================================================

// Rows with a usable position (star-level ra/dec/dist), sorted by planet letter.
function positionRows(rows) {
  return rows
    .filter((r) => r.ra != null && r.dec != null && r.sy_dist != null)
    .sort((a, b) => cmp(a.pl_letter ?? '', b.pl_letter ?? ''));
}

/**
 * Pure transform: raw rows -> { contents, supplement } plain objects + stats.
 * No IO, no Date, no randomness. Called twice by runProcess for the
 * byte-identical self-check.
 */
function transform(rawRows) {
  // --- filter + per-reason drop counts (independent, matching the design's
  //     TAP-derived reference numbers: letter 0 / orbital 7 / physical 7 /
  //     position 27 / spectral 260). A row can fail several reasons at once. ---
  const drops = { letter: 0, orbital: 0, physical: 0, position: 0, spectral: 0 };
  let uniqueDropped = 0;
  const survivors = [];
  for (const r of rawRows) {
    const noLetter = r.pl_letter == null;
    const noOrbital = r.pl_orbper == null && r.pl_orbsmax == null;
    const noPhysical = r.pl_bmasse == null && r.pl_rade == null;
    const noPosition = r.ra == null || r.dec == null || r.sy_dist == null;
    const noSpectral = r.st_spectype == null && r.st_teff == null;
    let dropped = false;
    if (noLetter) { drops.letter++; dropped = true; }
    if (noOrbital) { drops.orbital++; dropped = true; }
    if (noPhysical) { drops.physical++; dropped = true; }
    if (noPosition) { drops.position++; dropped = true; }
    if (noSpectral) { drops.spectral++; dropped = true; }
    if (dropped) { uniqueDropped++; continue; }
    survivors.push(r);
  }

  // --- group ALL raw rows by host (supplement lookups need hosts that may or
  //     may not have surviving planets); group survivors separately for hosts. ---
  const allByHost = new Map();
  for (const r of rawRows) {
    if (!allByHost.has(r.hostname)) allByHost.set(r.hostname, []);
    allByHost.get(r.hostname).push(r);
  }
  const survByHost = new Map();
  for (const r of survivors) {
    if (!survByHost.has(r.hostname)) survByHost.set(r.hostname, []);
    survByHost.get(r.hostname).push(r);
  }

  // --- contents hosts (only hosts with >=1 surviving planet) ---
  const hosts = [];
  for (const [hostname, rows] of survByHost) {
    rows.sort((a, b) => cmp(a.pl_letter, b.pl_letter));
    // Star-level fields from the smallest-letter position-bearing row (a survivor
    // has a position, so positionRows is non-empty; deterministic).
    const rep = positionRows(rows)[0];
    const pos = galacticPosition(rep.ra, rep.dec, rep.sy_dist);
    hosts.push({
      name: hostname,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      distPc: round6(rep.sy_dist),
      spect: spectralClass(rep.st_spectype, rep.st_teff),
      spectFull: rep.st_spectype ?? null,
      teff: rep.st_teff ?? null,
      snum: rep.sy_snum ?? null,
      pnum: rep.sy_pnum ?? null,
      planets: rows.map((p) => ({
        letter: p.pl_letter,
        name: p.pl_name,
        periodDays: p.pl_orbper ?? null,
        smaAU: p.pl_orbsmax ?? null,
        massEarth: p.pl_bmasse ?? null,
        radiusEarth: p.pl_rade ?? null,
        eccen: p.pl_orbeccen ?? null,
      })),
    });
  }
  hosts.sort((a, b) => cmp(a.name, b.name));

  // --- supplement (curated dim hosts) ---
  const missingCurated = [];
  const stars = [];
  for (const hostname of CURATED_DIM_HOSTS) {
    const rows = allByHost.get(hostname);
    if (!rows) { missingCurated.push(hostname); continue; }
    const rep = positionRows(rows)[0];
    if (!rep) { missingCurated.push(hostname); continue; }
    const pos = galacticPosition(rep.ra, rep.dec, rep.sy_dist);
    const vmag = rep.sy_vmag;
    stars.push({
      x: pos.x,
      y: pos.y,
      z: pos.z,
      mag: vmag != null ? round2(vmag) : null,
      absMag: vmag != null ? round2(vmag - 5 * Math.log10(rep.sy_dist / 10)) : null,
      spect: spectralClass(rep.st_spectype, rep.st_teff),
      ci: null,
      // archive st_lum is log10(L/Lsun); emit 10^value. HYG rounds lum to 2
      // decimals, but these marquee dim hosts sit at 10^-3..10^-2 L_sun —
      // toFixed(2) collapses them to 0 (ambiguous vs missing, and NaN/black-
      // sprite prone in any downstream log/scale math). Post-build ruling
      // 2026-07-12: 4 significant digits for supplement lum.
      lum: rep.st_lum != null ? parseFloat(Math.pow(10, rep.st_lum).toPrecision(4)) : null,
      name: DISPLAY_NAME_OVERRIDES[hostname] ?? hostname,
      dist: round6(rep.sy_dist / 1000),
      hostname,
    });
  }
  stars.sort((a, b) => cmp(a.name, b.name));

  const contents = { _license: LICENSE, _source: SOURCE, hosts };
  const supplement = { _license: LICENSE, _source: SOURCE, stars };

  const planetsOut = hosts.reduce((n, h) => n + h.planets.length, 0);
  return {
    contents,
    supplement,
    stats: {
      rawRows: rawRows.length,
      drops,
      uniqueDropped,
      hostsOut: hosts.length,
      planetsOut,
      supplementCount: stars.length,
      missingCurated,
    },
  };
}

// ---------------------------------------------------------------------------
// Self-checks. Each pushes a human-readable failure string; any failure => exit 1.
// ---------------------------------------------------------------------------
function checkContents(contents, failures) {
  const hosts = contents.hosts;
  // sorted by name (code-point) + no duplicate hostname
  const seen = new Set();
  for (let i = 0; i < hosts.length; i++) {
    if (seen.has(hosts[i].name)) failures.push(`duplicate hostname: ${hosts[i].name}`);
    seen.add(hosts[i].name);
    if (i > 0 && cmp(hosts[i - 1].name, hosts[i].name) > 0) {
      failures.push(`hosts not sorted at ${hosts[i - 1].name} > ${hosts[i].name}`);
    }
  }
  // every host position + spect present; planets valid; planets sorted by letter
  for (const h of hosts) {
    if (![h.x, h.y, h.z].every((v) => typeof v === 'number' && Number.isFinite(v))) {
      failures.push(`host ${h.name} missing/invalid position`);
    }
    if (!h.spect) failures.push(`host ${h.name} missing spectral class`);
    if (h.snum == null || h.pnum == null) failures.push(`host ${h.name} missing snum/pnum`);
    if (!Array.isArray(h.planets) || h.planets.length === 0) {
      failures.push(`host ${h.name} has no planets`);
    }
    let prevLetter = null;
    for (const p of h.planets) {
      if (p.letter == null || p.letter === '') failures.push(`host ${h.name} planet missing letter`);
      if (prevLetter != null && cmp(prevLetter, p.letter) > 0) {
        failures.push(`host ${h.name} planets not sorted by letter`);
      }
      prevLetter = p.letter;
      const hasOrbital = p.periodDays != null || p.smaAU != null;
      const hasPhysical = p.massEarth != null || p.radiusEarth != null;
      if (!hasOrbital) failures.push(`host ${h.name} planet ${p.letter} missing orbital param`);
      if (!hasPhysical) failures.push(`host ${h.name} planet ${p.letter} missing physical param`);
    }
  }
  // Host–host proximity. Distinct real hosts closer than POSITION_MATCH_TOL
  // exist: the archive lists binary components as separate hostnames at
  // (near-)identical coordinates. Post-build ruling 2026-07-12: pin the EXACT
  // set of known co-located real binaries (same idiom as
  // RealUniverseIngest.test.js) — a NEW near-pair is either a duplicate-ingest
  // bug or a new real binary that must be reviewed (and added here AND in the
  // test) before it ships; a STALE allowlist entry fails too. Increment-3's
  // hostname-first join disambiguates the real ones (AC10 "adjacent real
  // systems").
  const KNOWN_COLOCATED_HOST_PAIRS = new Set([
    'HD 20781|HD 20782',     // real wide binary, both planet hosts, 0.046 pc apart
    'TOI-2267 A|TOI-2267 B', // real binary; archive gives identical coordinates
  ]);
  const foundPairs = new Set(
    tooClosePairs(hosts, POSITION_MATCH_TOL)
      .map(([a, b]) => [a.name, b.name].sort(cmp).join('|')),
  );
  for (const pair of foundPairs) {
    if (!KNOWN_COLOCATED_HOST_PAIRS.has(pair)) {
      failures.push(`hosts within POSITION_MATCH_TOL and NOT in the known-binary allowlist: ${pair}`);
    }
  }
  for (const pair of KNOWN_COLOCATED_HOST_PAIRS) {
    if (!foundPairs.has(pair)) {
      failures.push(`stale known-binary allowlist entry (pair no longer co-located in the archive): ${pair}`);
    }
  }
}

// Star names physically linked to `name` by the curated companion table (the
// single multiplicity source of truth): members of the same entry's component +
// farCompanion name sets. Used to exempt physically-bound neighbors from
// duplicate detection (Proxima vs Rigil Kentaurus/Toliman).
function companionLinkedNames(name) {
  const linked = new Set();
  for (const e of STELLAR_COMPANIONS) {
    const members = [
      ...(e.components?.map((c) => c.name) ?? []),
      ...(e.farCompanions?.map((f) => f.name) ?? []),
    ].filter(Boolean);
    if (members.includes(name)) {
      for (const m of members) if (m !== name) linked.add(m);
    }
  }
  return linked;
}

function checkSupplement(supplement, failures) {
  const stars = supplement.stars;
  // curated list all resolved
  if (stars.length !== CURATED_DIM_HOSTS.length) {
    failures.push(`supplement has ${stars.length} stars, expected ${CURATED_DIM_HOSTS.length} curated hosts`);
  }
  // required fields present per entry
  for (const s of stars) {
    for (const f of ['x', 'y', 'z', 'mag', 'absMag', 'spect', 'dist', 'name', 'hostname']) {
      if (s[f] == null) failures.push(`supplement ${s.hostname} missing ${f}`);
    }
    if (s.ci !== null) failures.push(`supplement ${s.hostname} ci must be null`);
  }
  // no duplicate names / hostnames within supplement
  const nameSeen = new Set();
  const hostSeen = new Set();
  for (const s of stars) {
    if (nameSeen.has(s.name)) failures.push(`supplement duplicate name: ${s.name}`);
    if (hostSeen.has(s.hostname)) failures.push(`supplement duplicate hostname: ${s.hostname}`);
    nameSeen.add(s.name);
    hostSeen.add(s.hostname);
  }

  // clearance vs hyg-stars.json (position + name) and KnownSystems positions.
  const hyg = JSON.parse(readFileSync(HYG_PATH, 'utf8'));
  const hygNames = new Set(hyg.filter((h) => h.name).map((h) => h.name));
  const knownEntries = KnownSystems.getAll();
  for (const s of stars) {
    if (hygNames.has(s.name)) failures.push(`supplement name "${s.name}" collides with a hyg-stars.json name`);
    // Duplicate detection vs hyg uses the engine's actual identity tolerance
    // (POSITION_MATCH_TOL, 0.1 pc), NOT MATCH_RADIUS (0.5 pc) — real distinct
    // stars exist inside 0.5 pc (YZ Cet is a genuine 0.494 pc alignment with
    // Tau Cet). Physically-bound neighbors recorded by the companion table are
    // exempt: the contract's own Alpha Cen architecture REQUIRES Proxima
    // (0.055 pc from Rigil Kentaurus/Toliman) inside MATCH_RADIUS of the pair,
    // resolved via alias membership (d8d6b63 identity-agreement exemption),
    // never via radius shrinking. Post-build ruling 2026-07-12.
    const linked = companionLinkedNames(s.name);
    for (const h of hyg) {
      const d = dist3(s, h);
      if (d < POSITION_MATCH_TOL && !(h.name && linked.has(h.name))) {
        failures.push(`supplement ${s.name} within POSITION_MATCH_TOL of hyg star ${h.name ?? '(unnamed)'} (${d.toExponential(3)} kpc) — duplicate or unmodeled binary`);
      }
    }
    // Companion-table-derived exemption (mirror of the shipped
    // KnownSystems.match-radius swallow idiom; Increment-1 post-build ruling 2 /
    // d8d6b63 identity-agreement — same rule RealUniverseIngest.test.js applies).
    // A supplement star inside a KnownSystems entry's MATCH_RADIUS is a swallow
    // ONLY when it is NOT one of that entry's derived aliases. Increment 2
    // registers Alpha Centauri at Rigil's position; Proxima Centauri sits
    // 0.055 pc away — inside MATCH_RADIUS — but is aliased to Alpha Centauri via
    // the companion table (eagerly, since Proxima is below the HYG cut), so it
    // resolves by ALIAS MEMBERSHIP, never a radius swallow. A genuinely new
    // supplement star landing atop a KnownSystems position without an alias
    // still fails this.
    for (const ks of knownEntries) {
      const d = dist3(s, ks.position);
      if (d < MATCH_RADIUS && !ks.aliases.has(s.name)) {
        failures.push(`supplement ${s.name} within MATCH_RADIUS of KnownSystems position ${ks.name} (${d.toExponential(3)} kpc)`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Named-systems collision check (design §4). Every NEW real name this
// increment introduces — supplement display names + hostnames, archive
// hostnames from the contents file, and every companion-table name (top-level,
// component, far-companion), ANY shape — must NOT exactly match a name already
// shipped in namedSystemsCatalog.js (settled bare words or greek notables).
// The catalog was seeded with the OLD (hyg-only) blocklist, so a name newly
// introduced here could already exist in it; shape disjointness alone does not
// protect bare single-word real names ("Sirius"-shaped) from a settled entry.
// This does NOT regenerate the catalog — it only detects and reports; the
// contract treats a subsequent regen under the enlarged blocklist as in-scope
// remediation for the coordinator/main session, not something this script
// applies silently.
// ---------------------------------------------------------------------------
function collectNewRealNames(contents, supplement) {
  const names = new Set();
  for (const h of contents.hosts) names.add(h.name);
  for (const s of supplement.stars) {
    names.add(s.name);
    if (s.hostname) names.add(s.hostname);
  }
  for (const c of STELLAR_COMPANIONS) {
    if (c.name) names.add(c.name);
    for (const comp of c.components ?? []) if (comp.name) names.add(comp.name);
    for (const f of c.farCompanions ?? []) if (f.name) names.add(f.name);
  }
  return names;
}

function checkNamedSystemsCollision(contents, supplement, failures) {
  const newNames = collectNewRealNames(contents, supplement);
  const catalogNames = new Set(getNamedSystemsMap().values());
  const offenders = [...newNames].filter((n) => catalogNames.has(n)).sort(cmp);
  for (const o of offenders) {
    failures.push(`named-systems collision: real name "${o}" matches a shipped namedSystemsCatalog entry`);
  }
  return offenders;
}

function dist3(a, b) {
  const dx = a.x - b.x, dy = (a.y ?? 0) - (b.y ?? 0), dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

// Cross-ref stats: contents hosts whose name exactly matches a hyg star, and
// how far the two records sit apart (archive sy_dist vs HYG distance disagree
// for the same physical star). Report-only — an Increment-3 join-design input
// (join by NAME first), never a pass/fail: both values are faithful to their
// sources.
function hygCrossRefStats(contents) {
  const hyg = JSON.parse(readFileSync(HYG_PATH, 'utf8'));
  // HYG carries duplicate names (e.g. the Iot Pic twins) — collect ALL stars
  // per name and measure to the NEAREST, else a host pairs with the wrong
  // same-named star and the stat inflates.
  const byName = new Map();
  for (const h of hyg) {
    if (!h.name) continue;
    if (!byName.has(h.name)) byName.set(h.name, []);
    byName.get(h.name).push(h);
  }
  const dists = [];
  let beyondTol = 0;
  for (const host of contents.hosts) {
    const matches = byName.get(host.name);
    if (!matches) continue;
    const d = Math.min(...matches.map((m) => dist3(host, m)));
    dists.push(d);
    if (d >= POSITION_MATCH_TOL) beyondTol++;
  }
  dists.sort((a, b) => a - b);
  return {
    sameName: dists.length,
    beyondTol,
    medianPc: dists.length ? dists[Math.floor(dists.length / 2)] * 1000 : 0,
    maxPc: dists.length ? dists[dists.length - 1] * 1000 : 0,
  };
}

// Spatial-grid all-pairs-within-tol over items with numeric x/y/z (kpc).
function tooClosePairs(items, tol) {
  const grid = new Map();
  const key = (ix, iy, iz) => `${ix},${iy},${iz}`;
  const out = [];
  for (const it of items) {
    const ix = Math.floor(it.x / tol), iy = Math.floor(it.y / tol), iz = Math.floor(it.z / tol);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const bucket = grid.get(key(ix + dx, iy + dy, iz + dz));
      if (!bucket) continue;
      for (const other of bucket) {
        const d = dist3(it, other);
        if (d < tol) out.push([other, it, d]);
      }
    }
    const kk = key(ix, iy, iz);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(it);
  }
  return out;
}

function runProcess() {
  let raw;
  try {
    raw = JSON.parse(readFileSync(RAW_PATH, 'utf8'));
  } catch (e) {
    console.error(`[ingest] process FAILED: cannot read raw ${RAW_PATH}: ${e.message}`);
    console.error('[ingest] run "node scripts/ingest-exoplanets.mjs --fetch" first.');
    process.exit(1);
  }

  // Pure transform, run TWICE for the byte-identical self-check.
  const runA = transform(raw);
  const runB = transform(raw);
  const contentsJsonA = JSON.stringify(runA.contents);
  const contentsJsonB = JSON.stringify(runB.contents);
  const supplementJsonA = JSON.stringify(runA.supplement);
  const supplementJsonB = JSON.stringify(runB.supplement);

  const failures = [];
  if (contentsJsonA !== contentsJsonB) failures.push('contents NOT byte-identical across two in-memory process runs');
  if (supplementJsonA !== supplementJsonB) failures.push('supplement NOT byte-identical across two in-memory process runs');

  // Curated-host presence (design: script errors if a list entry is absent).
  if (runA.stats.missingCurated.length) {
    failures.push(`curated dim hosts absent from raw archive: ${runA.stats.missingCurated.join(', ')}`);
  }

  checkContents(runA.contents, failures);
  checkSupplement(runA.supplement, failures);
  const namedSystemsOffenders = checkNamedSystemsCollision(runA.contents, runA.supplement, failures);

  // Write outputs (compact; deterministic key order from object construction).
  mkdirSync(dirname(CONTENTS_PATH), { recursive: true });
  writeFileSync(CONTENTS_PATH, contentsJsonA);
  writeFileSync(SUPPLEMENT_PATH, supplementJsonA);

  // Report.
  const s = runA.stats;
  console.log('[ingest] process complete.');
  console.log(`  raw rows:            ${s.rawRows}`);
  console.log(`  drops (per reason):  letter=${s.drops.letter} orbital=${s.drops.orbital} physical=${s.drops.physical} position=${s.drops.position} spectral=${s.drops.spectral}`);
  console.log(`  unique rows dropped: ${s.uniqueDropped}`);
  console.log(`  hosts out:           ${s.hostsOut}`);
  console.log(`  planets out:         ${s.planetsOut}`);
  console.log(`  supplement stars:    ${s.supplementCount}`);
  console.log(`  companion entries:   ${STELLAR_COMPANIONS.length}`);
  const xref = hygCrossRefStats(runA.contents);
  console.log(`  hyg same-name xref:  ${xref.sameName} hosts share a hyg name; ${xref.beyondTol} beyond POSITION_MATCH_TOL (median ${xref.medianPc.toFixed(2)} pc, max ${xref.maxPc.toFixed(1)} pc) — Increment-3 merge joins by NAME first`);
  console.log(`  contents:  ${CONTENTS_PATH} (${(contentsJsonA.length / 1024).toFixed(0)} KB) sha256=${sha256(contentsJsonA)}`);
  console.log(`  supplement:${SUPPLEMENT_PATH} (${(supplementJsonA.length / 1024).toFixed(0)} KB) sha256=${sha256(supplementJsonA)}`);
  console.log(`  named-systems collisions: ${namedSystemsOffenders.length}` +
    (namedSystemsOffenders.length ? ` (${namedSystemsOffenders.join(', ')})` : ''));

  if (failures.length) {
    console.error(`\n[ingest] ${failures.length} SELF-CHECK FAILURE(S):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log('\n[ingest] all self-checks passed.');
}

// ---------------------------------------------------------------------------
function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}
function sizeKB(path) {
  return (readFileSync(path).length / 1024).toFixed(0);
}

// ===========================================================================
const isFetch = process.argv.includes('--fetch');
if (isFetch) {
  await runFetch();
} else {
  runProcess();
}
