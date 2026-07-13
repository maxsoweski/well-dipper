# Increment 1 (AC7) — build design

> Written 2026-07-12 by working-Claude before the build workflow; the build agents
> follow this design. Function + intent record per `record-build-intent`.
> Contract: `contract.json` AC7 (+ AC8 guardrail). Do not widen scope.

## What Increment 1 is (and is not)

Build-time **data delivery only**: re-runnable scripts + shipped data files +
build-time verification + tests. NO engine/runtime wiring (RealStarCatalog does
not load the supplement yet — that is Increment 2/3), NO overlay merge, NO UI.

## Live-verified source facts (2026-07-12, TAP queries)

- Source: NASA Exoplanet Archive, `pscomppars` table (Planetary Systems
  Composite Parameters — one row per confirmed planet), via TAP sync:
  `https://exoplanetarchive.ipac.caltech.edu/TAP/sync?format=json&query=...`
- Counts today: 6,319 planet rows; 4,735 distinct hosts.
- Required-field gaps (rows): letter 0; orbital (per+sma both null) 7;
  physical (mass+radius both null) 7; position (ra/dec/sy_dist) 27;
  spectral (st_spectype+st_teff both null) 260. Ingest FILTERS these out and
  REPORTS per-reason drop counts (no silent truncation).
- TRAPPIST-1: 7 planets (b–h). Proxima Cen: 2 planets (b, d). Both present.
- License: attribution-based. Embed in generated files:
  "This research has made use of the NASA Exoplanet Archive, which is operated
  by the California Institute of Technology, under contract with the National
  Aeronautics and Space Administration under the Exoplanet Exploration Program."

## Deliverables

### 1. `scripts/ingest-exoplanets.mjs` (NEW)

Two modes, HYG-pattern (raw committed in `data/catalogs/`, processing pure):

- `--fetch`: TAP query → `data/catalogs/pscomppars-raw.json` (committed, ~3 MB).
  Columns: `hostname, pl_letter, pl_name, ra, dec, sy_dist, sy_snum, sy_pnum,
  sy_vmag, st_spectype, st_teff, st_lum, st_rad, st_mass, pl_orbper,
  pl_orbsmax, pl_bmasse, pl_rade, pl_orbeccen`, `order by pl_name` (stable).
- default (pure, deterministic, byte-identical re-runs): raw →
  `public/assets/data/real-system-contents.json`:
  - Filter rows per required fields above; count drops per reason; print report.
  - Group by hostname → hosts sorted by name; planets sorted by letter.
  - Position: ra/dec (deg) + sy_dist (pc) → equatorial xyz (pc) → galactic →
    galactocentric kpc. MUST reuse the exact rotation matrix + SOLAR_X/SOLAR_Z
    convention of `scripts/process-hyg-catalog.mjs` (including its
    `{x: x_gal, y: z_gal, z: y_gal}` axis swap) so overlay-merge position joins
    (Increment 3) are exact.
  - Spectral class letter: first char of `st_spectype` when it starts with
    O/B/A/F/G/K/M/L/T/Y/D/W/C/S; else Teff bins (≥30000 O, ≥10000 B, ≥7500 A,
    ≥6000 F, ≥5200 G, ≥3700 K, ≥2400 M, else M). Keep full `st_spectype` too.
  - Host shape: `{ name, x, y, z, distPc, spect, spectFull, teff, snum, pnum,
    planets: [{ letter, name, periodDays, smaAU, massEarth, radiusEarth,
    eccen }] }` (absent measurement → null; letter/name always present).
  - Top-level: `{ _license, _source, hosts }`. NO timestamps (byte-identical).
  - Build-time self-checks (script exits nonzero on failure): no duplicate
    hostname; no two hosts within 0.0001 kpc (POSITION_MATCH_TOL); every host
    position+spect present; every planet letter + ≥1 orbital + ≥1 physical;
    process step run twice in-memory → identical strings.

### 2. Dim famous hosts supplement (in same script, separate output)

`public/assets/data/real-star-supplement.json` — famous confirmed hosts BELOW
the HYG naked-eye cut (mag < 7 missing from hyg-stars.json), as NEW real
catalog stars at TRUE positions. Curated list (in-script const): Proxima Cen,
TRAPPIST-1, Barnard's star, Ross 128, Wolf 1061, Luyten's star (GJ 273),
YZ Cet, Teegarden's star, GJ 1002, GJ 1214, LHS 1140, Kepler-90, Kepler-186,
Kepler-452. Rules:

- Every list entry MUST exist in the raw archive data (else script errors) —
  positions/params come from the archive, never hand-typed.
- Entry shape mirrors hyg-stars.json: `{ x, y, z, mag, absMag, spect, ci, lum,
  name, dist }` — `mag` = sy_vmag; `absMag` = sy_vmag − 5·log10(sy_dist/10);
  `ci` null; `lum` from st_lum (archive gives log10(L/Lsun) → emit 10^value,
  rounded like HYG) or null; `dist` in kpc; name = display name (see below).
- Display names: use the archive hostname except Proxima Cen → "Proxima
  Centauri" and Barnard's star → "Barnard's Star" (player-recognizable forms;
  these become nav labels + aliases later). Keep a `hostname` field with the
  exact archive hostname so contents join stays exact.
- Self-checks: no supplement star within 0.0005 kpc (MATCH_RADIUS) of an
  existing hyg-stars.json star OR of a KnownSystems position (Proxima at
  1.30 pc from Sol must pass 0.5 pc clearance — verify, don't assume); no
  duplicate names vs hyg-stars.json names.

### 3. Curated stellar-companion table (NEW, hand-authored source data)

`src/generation/data/stellarCompanions.js` — JS module (importable by engine,
tests, and build scripts). THE single multiplicity source of truth (AC7):
consumed later by overlay merge (AC3/AC4: Sirius, Procyon) and AC5 registry
authoring (Alpha Centauri A+B) — never duplicated elsewhere.

- Kind discriminator REQUIRED per entry:
  - `kind: 'multiple'` → `components` (2 close stars max, ordered primary
    first) each `{ name, class }`; companion carries `separationAU`; optional
    `farCompanions: [{ name, class, separationAU }]` for the wide members
    (Proxima). No third close star (AC10 cap).
  - `kind: 'single'` → singleness marker only; MUST NOT carry companion fields.
- Initial content (famous first, per contract): Sirius (A1V + DA2 white dwarf
  Sirius B, ~19.5 AU mean), Procyon (F5IV-V + DQZ white dwarf Procyon B,
  ~15 AU), Alpha Centauri (G2V Rigil Kentaurus + K1V Toliman, ~23.5 AU mean;
  farCompanions: Proxima Centauri, M5.5Ve, ~13,000 AU). Pinned singles: Vega,
  Altair, Fomalhaut is a wide multiple — do NOT pin it single; verify each
  single via web sources before pinning. Companion classes use a `D` class
  letter for white dwarfs (AC10's degenerate class).
- Every companion/component entry cites its separation source in a comment
  (astronomy facts verified via web during build, not from memory).

### 4. Blocklist enlargement + named-catalog collision check

- `scripts/gen-real-proper-names.mjs`: extend input set to hyg-stars.json ∪
  real-star-supplement.json names ∪ real-system-contents.json hostnames ∪
  companion-table star/component/farCompanion names. Same single-token
  alphabetic extraction (structural collision class unchanged). Regenerate
  `src/generation/data/realProperNames.js`.
- Named-systems check: cross-check ALL new real names (any shape, both display
  and archive hostnames) against the shipped namedSystemsCatalog names. If any
  collision → regenerating namedSystemsCatalog.js via gen-named-systems.mjs
  under the enlarged blocklist is IN-SCOPE remediation (contract AC7). Add the
  check to the ingest script's self-checks (report, nonzero exit on collision
  so the build can't ship a collision silently).

### 5. Tests — `src/generation/__tests__/RealUniverseIngest.test.js` (NEW)

Unit layer, no network (reads committed outputs):
- contents file: parses; ≥4,000 hosts (sanity floor, not exact — archive
  grows); every host position+spect; every planet letter + ≥1 orbital + ≥1
  physical; snum/pnum present; hosts sorted, no duplicate names, no two hosts
  within POSITION_MATCH_TOL; TRAPPIST-1 host with exactly planets b,c,d,e,f,g,h;
  Proxima Cen host with b,d.
- supplement: shape fields present; Proxima Centauri + TRAPPIST-1 present;
  every entry ≥ MATCH_RADIUS from every KnownSystems position; no name or
  position duplicate vs hyg-stars.json.
- companion table: discriminator rules enforced (multiple → ≤2 components with
  class + separation; single → no companion fields); Sirius/Procyon/Alpha Cen
  present; Alpha Cen farCompanions includes Proxima Centauri; each entry's
  ANCHOR (primary component / pinned single) resolves in hyg-stars.json ∪
  supplement names, and so does every farCompanion (they are real catalog
  stars). Close companions (Sirius B, Procyon B) are NEW content the overlay
  adds — deliberately NOT in any catalog, so no resolvability requirement.
- blocklist: realProperNames.js regenerated content is a superset of the old
  set; NameGenerator.injective + census suites stay green (run as part of full
  suite, not duplicated here).

## Non-goals (deliberate)

- No RealStarCatalog/NavComputer/StarSystemGenerator changes (Increments 2–4).
- No bulk WDS ingest; multiplicity = curated table only (post-review ruling 6).
- No namedSystemsCatalog regen unless the collision check actually fires.
- ProcgenSnapshot.test.js already carries the AC8 re-filter (reads the two
  canonical output paths above — do not rename them without updating it).

## Lane etiquette

Everything above is lane-C-owned (generation/catalog files + scripts +
`src/generation/__tests__/`). Zero main.js / NavComputer / GalacticMap edits
in this increment.
