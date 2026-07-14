# Increment 5 (AC1 + AC6 + snum-pin + Alpha-Cen fill) — build design

> Written 2026-07-14 by working-Claude before the build. Function + intent
> record per `record-build-intent`. Contract: `contract.json` AC1, AC6, plus an
> AC4 amendment (the adopted snum==1 single-pin) and the AC8 guardrail. Do not
> widen scope. Ground truth from two read-only exploration passes over
> `58d11f3` (facts below are code-verified; line refs are point-in-time — the
> symbols are the durable anchors).

## What Increment 5 is (and is not)

The **true-to-observation** increment, closing the workstream's build phase:

- **AC1 — neighborhood fidelity:** author the committed closed reference table
  `neighborhood-reference.json` (exact expected named neighbors from Sol and
  from Sirius, each with a reference distance), fix the nav prism's
  real-star **position snap** (a code-verified violation of interview ruling 1
  — see fact 3), then live-drive the ±2% assertion from both vantages.
- **AC6 — structures audit:** extend the Harris ingest to per-cluster real
  radii (replacing the flagged uniform `radius: 0.03` placeholder for all 152
  globulars), and commit an audit script + report comparing the 37
  `KnownObjectProfiles` and the globular catalog against reference values,
  with documented tolerances and per-entry rationales.
- **snum==1 single-pin** (ADOPTED, `representation-cap.md §5` blockquote,
  `cd8abd0`): a real host whose archive record says the system has exactly one
  star suppresses the procgen companion roll. One-directional; curated table
  wins. Includes the contract AC4 amendment + `validate.mjs`.
- **Alpha-Cen A/B fill ruling** (Max, 2026-07-14): **fill-on**, conditioned on
  the fill producing planetless systems at an astronomy-plausible rate. Both
  halves resolve to **documentation, not code** — see facts 14–16 and D8.

**Not** in Increment 5: AC9 (Max's batched UAT — workstream end, never
agent-marked); adding the six absent famous stars (Wolf 359 etc., fact 6) to
the supplement (a data-scope change — recorded as a documented gap);
eccentric-orbit rendering or the circumbinary orbit-range quirk (fact 15,
recorded observation only); any universe-wide change to the empty-system rate
(AC8 forbids it in this workstream — D8 names the seam for a successor); nav
rendering internals beyond the two seam-recorded touches (lane D).

## Rulings applied this increment

1. **snum==1 single-pin — ADOPTED 2026-07-13** (contract deviation to
   post-review ruling 6; recorded in `representation-cap.md §5`). Implemented
   here per D7.
2. **Alpha Centauri A/B fill — ruled 2026-07-14.** Max: *"I'm fine with
   fill-on so long as we occasionally get systems where there are no planets
   at a rate predicted by the relevant astronomy/physics."* Applied per D8.

## Code-verified facts the build MUST honor

### AC1 — neighborhood data + nav display

1. **One frame, no scale factor.** Catalogs and nav both use galactocentric
   Cartesian **kpc**, Sol at `(8.0, 0.025, 0)`; star `dist` = kpc from Sol,
   consistent with positions to 6 decimals. The nav displays kpc×1000 as pc.

2. **The closed neighbor sets.** Within 5 pc of Sol: **19 named stars**
   (12 HYG + 7 supplement). Within 5 pc of Sirius: **15 named entries
   including Sol** (Sol's explicit regen entry, `dist:0`, is a legitimate
   neighbor at 2.64 pc from Sirius). No null-named or quote-artifact entries
   fall inside either volume. Shipped name strings carry traps the table MUST
   encode verbatim: Epsilon Eridani = `Ran`, Tau Ceti = `Tau Cet`, Epsilon
   Indi = `Eps Ind`, 61 Cygni A/B = `HD 201091`/`HD 201092`, 40 Eridani =
   `Keid`, Alpha Cen A/B = `Rigil Kentaurus`/`Toliman`. Near-namesake traps:
   `Lacaille 8760` is NOT Lacaille 9352; `HD 88230` (GJ 380) is NOT
   Lalande 21185.

3. **The position snap (the AC1 defect this increment fixes).** In
   `NavComputer._queryYRange`'s real-star overlay merge, a real star matching
   a hash-grid star within `MATCH_DIST = 0.002` kpc keeps the **hash-grid**
   `wx/wy/wz` and `dist`, overwriting only `name`/`isReal`/`spectral`/`color`.
   At procgen density most neighbors DO match, so the prism renders real names
   at procgen positions up to 2 pc off — >100% displayed-distance error for
   Rigil at 1.3 pc. This violates interview ruling 1 (*"True positions, never
   nearest-procgen snapping — a real system's location may not depend on
   procgen output"*) and AC1's "real names at true positions". In-scope fix,
   not scope creep.

4. **Nav visibility mechanics.** The prism queries an **axis-aligned box**
   (`findInVolume`, no magnitude cut, no count cap on real stars): XZ
   half-extent `_localCubeSize` ≈ 10 pc at Sol density (floor 3 pc); Y starts
   ≈±6 pc then `_scheduleBgExpand` grows in 100 pc steps to ±3 kpc. So
   **TRAPPIST-1** (12.43 pc, Δy −10.4 pc, supplement) IS assertable from Sol —
   but only after the first background Y-expansion tick. Real named stars get
   gold labels of `star.name` (the HYG string); the KnownSystems alias layer
   NEVER renames prism labels (it fires only at arrival + search), so the
   prism shows `Rigil Kentaurus`/`Toliman`, never "Alpha Centauri".

5. **Reference distances must derive from the shipped catalog**, not external
   astronomy: some K/M-dwarf Hipparcos (HYG) distances differ from modern Gaia
   by >2%, so an externally-sourced value can fail ±2% without any pipeline
   bug. Names/presence carry the astronomy truth; distances pin the pipeline.
   The documented 104/116 Hipparcos-vs-Gaia host discrepancy affects contents
   hosts only, not these bright HYG neighbors.

6. **Absent famous stars (documented gap, never asserted):** Wolf 359,
   Lalande 21185, Luyten 726-8/UV Ceti, Ross 154, Ross 248, Lacaille 9352
   exist in neither HYG (mag < 7.0 cut) nor the 14-entry supplement.

7. **Live extraction handles.** The loaded catalog is reachable as
   `window._skyRenderer._starfieldGenerator.realStarCatalog` (same instance
   the nav renders from). There is **no window handle to `_navComputer`**
   today — D3 adds one. Search-surface checks must query FULL shipped names
   (the resolver's `STAR_CAP = 10` truncates broad substring scans).

### AC6 — structures data + consumption

8. **`KnownObjectProfiles` (37)**: hand-authored `galacticPos` {x,y,z} kpc
   (derived from each entry's `l/b/d` comment) + physical `radius` kpc + type
   + render-style fields. Consumed by the GalacticMap injection block
   (procgen-feature dedup within 2×radius; `insideFeature` = dist < radius),
   `StyleProfileAdapter` (render size is a SEPARATE scene-unit field), and
   search (display). Precedent: the IC434/M78 position fix; pinned by
   `KnownObjects.test.js` (all positions numeric, radius > 0, M42 x ≈ 8.35)
   and `tests/known-object-feature-seed.test.js`.

9. **The globular placeholder is real and consequential.**
   `RealFeatureCatalog._loadGlobularClusters()` maps
   `globular-clusters.json` (id, name, x/y/z kpc, rSun, rGc, l, b — **no size
   field**) to features with uniform `radius: 0.03` kpc. `HashGridStarfield`
   turns that radius into visible cluster extent (giant concentration within
   3×radius, packing/type effects within radius) — so all 152 clusters render
   as identical 30 pc balls.

10. **The reference data is already in-repo.**
    `data/catalogs/harris_globular_clusters.dat` is the full Harris (2010)
    three-part catalog; Part III carries core radius `r_c`, half-light radius
    `r_h` (arcmin) and King concentration `c = log(r_t/r_c)`.
    `scripts/process-harris-catalog.mjs` parses **Part I only** — that's why
    radius is a placeholder. Conversion: `r_pc = θ_arcmin × 2.90888e-4 ×
    (rSun_kpc × 1000)`; tidal radius `r_t = r_c · 10^c` best matches the
    renderer's "visible ball" semantics (r_h under-represents it). Part III
    quirks the parser must handle: collapsed-core clusters flag `c` (e.g.
    `2.50c`); some entries lack values → fallback `4 × r_h`; lacking both →
    keep 0.03 with a rationale row.

11. **AC8 hazard specific to D5 (check empirically in build):** feature
    `radius` feeds `findNearby → insideFeature` and the HashGridStarfield
    population context. Enlarging a cluster's radius (30 pc → r_t up to
    ~100 pc) could pull a previously-outside position inside a cluster's
    influence. If any of the 24 ProcgenSnapshot systems drifts, do NOT
    silently re-filter — surface it at the seam (the honest framing is that
    AC6's correction extends real-data coverage, but the contract's re-filter
    clause names the *ingested position set*, so extending its semantics is
    Max's call, not the build's).

### snum==1 single-pin

12. **The suppress mechanism already exists.** `StarSystemGenerator.generate`:
    `companionSpec.kind === 'single'` → `forceBinary = false` → the
    `rng.chance(0.35 × binaryModifier)` draw is **skipped** (pinned by
    `StarSystemGenerator.overlay.test.js` "single-pin suppresses the binary
    roll" and the AC4(d) Vega pipeline test). Skipping the draw shifts that
    host's downstream RNG stream — deterministic and revisit-stable, and it
    only fires for hosts with a contents record (AC8-excluded), but it IS a
    real change to those hosts' systemData; document in the cap amendment.

13. **Hook + data + safety.** `RealSystemOverlay.resolve()` sets
    `companionSpec` only from a `STELLAR_COMPANIONS` name match; the no-table
    branch is the hook site. Hosts carry `snum` (`sy_snum`) from the ingest:
    ~4,050 of ~4,457 hosts are snum==1 (~91%), ~407 snum≥2, and **zero snum≥2
    hosts overlap the curated table today** (table-wins is a forward-safety
    invariant with an empty current intersection; `Proxima Cen` snum:3 is a
    far-companion reached via the alias path, not the bulk overlay;
    TRAPPIST-1 is snum:1). AC8 safety holds by construction: `resolve()`
    returns `{}` for non-host stars (pinned by the AC4(b) Betelgeuse test) and
    `main.js` never calls `applyToContext` for non-overlay arrivals.
    **Known breakage:** `RealSystemOverlay.pipeline.test.js` AC3 TRAPPIST-1
    asserts `isBinary === true` from a *rolled spurious companion* to prove
    known-planet immunity — the pin suppresses that roll, so the immunity
    demonstration must move to a new vehicle (a snum≥2 contents host on a
    binary-rolling seed, or a table-forced binary + injected knowns).

### Alpha-Cen fill + the zero-planet condition

14. **Fill-on is the current behavior — zero code.** `buildAuthoredContext`
    sets `starTypeOverride 'G'`, the A+B `companionSpec` (23.5 AU), Proxima
    `farCompanions` (planets b, d, data-level) and does NOT set
    `knownPlanets`; `StarSystemGenerator` then procgen-fills A/B normally.

15. **The zero-planet tail already exists and fires on exactly the right
    systems.** Planet count = `rng.chance(0.08) ? 0 :
    round(gaussianClamped(mean, 1.5, 1, max))` — an **8% empty roll**, shared
    by all paths, with a non-empty floor of 1. Contents hosts are floored at
    ≥1 by their knowns (astronomy-correct: detected planets exist); procgen
    systems and planet-free real hosts (Sirius, Alpha Cen A/B) get the 8%
    tail. `rng.chance(p)` consumes exactly one draw for any p (outcome-only
    sensitivity). Zero-planet systems are a well-trodden path (~8% of all
    procgen today) with guards throughout main.js/PhysicsEngine/ExoticOverlay;
    two bare `planets[0]` reads (an autopilot/framing path, and one inside a
    length-guard) get a spot-verification only — pre-existing surface, not
    Inc-5's to fix. Recorded quirk, out of scope: circumbinary fill starts at
    `2.5 × 23.5 ≈ 58.75` AU, beyond G's normal ~50 AU max orbit.

16. **Astronomy basis (researched 2026-07-14).** ~30±3% of FGK stars host
    Kepler-like systems (avg 3.0±0.3 planets; He/Zhu et al., arXiv:1802.09526);
    Kepler statistics put ≥50% of stars harboring planets as a lower bound;
    the truly-planetless fraction is observationally unconstrained and
    strongly metallicity-dependent (metal-poor stars are overwhelmingly
    planet-free) — plausibly ~10–50%. The engine's 8% sits inside that
    envelope, on the planet-rich side. Any recalibration ≠ 0.08 cannot touch
    the shared constant in this workstream (AC8): the safe seam is a ctx
    override (`galaxyContext.emptyChanceOverride ?? 0.08`) settable only on
    overlay/authored contexts — **named here, not built** (D8).

## Design decisions

- **D1 — `neighborhood-reference.json` is generated, reviewed, committed.**
  A deterministic script `scripts/gen-neighborhood-reference.mjs` reads the
  shipped catalogs and emits the closed table: for each origin (`Sol`,
  `Sirius`), every named star within 5.0 pc, as
  `{name, refDistPc (3 decimals), spect, source: 'hyg'|'supplement'}`, sorted
  by distance; plus a top-level `absentFamous` documented-gap list (fact 6)
  and a `derivation` note (5 pc radius, shipped-catalog provenance, ±2%
  tolerance rationale per fact 5). Expected content is the fact-2 sets
  (19 Sol / 15 Sirius incl. Sol) — the build reviews the generated names
  against that checklist before committing. Byte-identical re-run, no
  timestamps (the `ingest-exoplanets.mjs` determinism pattern). Output path
  is pinned by AC1:
  `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/neighborhood-reference.json`.

- **D2 — True-position fix in the prism merge.** In `_queryYRange`'s matched
  branch, ALSO overwrite the merged entry's `wx/wy/wz` with the real star's
  catalog position and recompute `dist`/`distPc` from the player position
  (name/spectral/color handling unchanged; the hash-grid `seed` is retained —
  identity at arrival is already carried by name/navStarData, and exact
  positions can only improve alias/position resolution). Unit-test the merge
  directly. This closes fact 3 and makes the live ±2% assertion honest — it
  reads what the nav actually renders.

- **D3 — Read-only nav handle via self-registration.** `NavComputer`'s
  constructor sets `window._navComputer = this` (browser guard included).
  Chosen over a main.js export to avoid a fifth flagged main.js edit; it
  extends the Inc-4 ratified seam record (see below). Used by live drives
  (read `_localStars`) and harmless in play.

- **D4 — AC1 live drive, both vantages.** On `:5176`, from a settled idle
  system (boot-tour rule): at Sol, open nav (`N`), allow the Y-expansion tick,
  read `window._navComputer._localStars` → assert every Sol table entry
  present by exact name with `|distPc − refDistPc| ≤ 2%`; cross-check against
  `realStarCatalog.findInVolume` from the fact-7 handle; TRAPPIST-1 presence
  included. Search→warp→Sirius (the Inc-4 green path), repeat for the Sirius
  table (Sol appears at 2.64 pc). Absent-famous stars are never asserted.
  AC8 live: `enterSol()` 19/19; console clean; leave Max's window at Sol,
  panel closed; close agent pages (browser hygiene).

- **D5 — Per-cluster radii from Harris Part III.** Extend
  `process-harris-catalog.mjs`: parse Part III, join to Part I by `ID`, emit
  per-cluster `radiusKpc` (= `r_c·10^c` tidal radius converted at `rSun`),
  plus `rHalfPc` and `concentration` for the audit; handle the collapsed-core
  `c` flag; fallbacks per fact 10. Regenerate `globular-clusters.json`;
  `RealFeatureCatalog` maps `radius: gc.radiusKpc ?? 0.03`. Assert
  non-uniformity (e.g. Omega Cen > 47 Tuc > a Palomar dwarf) and spot-check
  hand-computed values. Run the fact-11 ProcgenSnapshot hazard check
  immediately after regen.

- **D6 — Committed audit: script + reference + report.** New
  `scripts/audit-structures.mjs`: (a) globulars — recompute positions from
  the `.dat` and compare against the shipped JSON (self-consistency, tight
  tolerance) and radii against the D5 derivation; (b) profiles — compare the
  37 `KnownObjectProfiles` positions/radii against a committed reference JSON
  (`structures-reference.json`: per-entry `l/b/d` + size from published
  values, each row source-noted) with documented tolerances (proposed
  defaults, tunable in build with written rationale: profile positions within
  0.05 kpc or 15% of distance — they were hand-derived from l/b/d; sizes
  within a factor of 2 — nebular "size" is genuinely fuzzy). Output: an audit
  report (`structures-audit.md`) committed to this workstream dir; every
  out-of-tolerance entry either corrected in `KnownObjectProfiles.js` or
  carrying a written rationale row (the AC6 observable). Vitest (unit layer)
  reads the committed reference/report data and asserts the famous set (M42,
  IC434/Horsehead, M78, 47 Tuc, Omega Cen, …) within tolerance, extending the
  `KnownObjects.test.js` idiom.

- **D7 — snum==1 single-pin.** In `RealSystemOverlay.resolve()`'s no-table
  branch: when the joined `host.snum === 1`, synthesize
  `result.companionSpec = { kind: 'single', source: 'archive-snum' }` — it
  rides the existing `applyToContext → forceBinary=false` path with no
  `StarSystemGenerator` edit. One-directional and table-wins **by
  construction** (only fires when `tableEntry` is null; can only suppress).
  Contract amendment: extend AC4's statement + verifyVia with the snum case
  (new input/observable case (e): a snum==1 non-table host on a
  binary-rolling seed → no companion) + run
  `node ~/projects/personal-os-improvements/dev-collab/validate.mjs contract <path>`.
  Update the `representation-cap.md §5` blockquote from "scheduled" to
  implemented (including the fact-12 RNG-stream note). Rework the AC3
  TRAPPIST-1 immunity vehicle (fact 13). New tests: (1) snum==1 non-table
  host on a binary-rolling seed → `isBinary false`, `star2 null`, knowns
  intact, generate-twice deep-equal; (2) snum≥2 non-table host → roll stays
  live; (3) synthetic table-overlap → table wins, snum ignored; (4) extend
  AC4(b): a non-host real star never gains `companionSpec` from the pin.

- **D8 — Alpha-Cen fill + zero-planet condition resolve to documentation.**
  Fill-on = current behavior (fact 14): no code. Max's condition is met by
  the existing 8% empty roll on exactly the planet-free population (facts
  15–16): no code. Record both in a new `representation-cap.md §6` ("Planet
  fill and the empty-system rate"): Max's ruling verbatim, the mechanism, the
  astronomy basis with sources, the circumbinary orbit quirk, and the named
  ctx-override calibration seam for any future rate change (with the explicit
  note that a universe-wide rate change is successor-workstream territory
  under AC8).

- **D9 — AC8 guardrail.** Full vitest from the repo dir grows from **1,340**
  (0 new failures); ProcgenSnapshot deep-equal (with the fact-11 check after
  D5's regen); live `enterSol()` 19/19 during the D4 pass.

## Extension of the ratified NavComputer seam (record for lane D)

Increment 4's seam record (`increment-4-design.md`) listed four lane-C touches
in lane-D-owned `NavComputer`. Increment 5 adds two, same spirit (minimal,
integration-point-documented):

5. The `_queryYRange` real-star merge now writes the REAL star's position and
   player-relative distance onto a matched entry (D2) — required by interview
   ruling 1 + AC1. If lane D reworks the prism query, preserve the invariant:
   *a real star's rendered position/distance comes from the catalog, never
   the hash grid*.
6. Constructor self-registration `window._navComputer = this` (D3) — a
   read-only debug/live-drive handle.

## Test plan

**Unit (headless, from the repo dir):**
- `gen-neighborhood-reference.mjs`: byte-identical re-run; emitted sets match
  the fact-2 checklist (19 Sol / 15 Sirius incl. Sol); absent-famous list
  present.
- The D2 merge fix: a matched real star's `_localStars` entry carries the
  catalog position + recomputed dist (synthetic hash-grid + catalog fixture).
- D5 parser: Part III join by ID; collapsed-core flag; fallbacks; spot values
  (Omega Cen, 47 Tuc) vs hand-computed; all-152 non-uniform radii;
  regenerated JSON byte-stable on re-run.
- D6 audit: famous-set tolerance assertions off the committed reference;
  out-of-tolerance entries have rationale rows.
- D7 snum tests (1)–(4) + the reworked AC3 immunity vehicle.
- Contract re-validates after the AC4 amendment.

**Integration (headless + live):**
- Headless: overlay pipeline suite green post-pin (TRAPPIST-1 now single).
- Live per D4 (both vantages, ±2%, TRAPPIST-1, Sol 19/19, console clean).

**AC8 (every increment):** suite ≥1,340 → grows; ProcgenSnapshot deep-equal
(fact-11 check); live Sol 19/19.

## Files (anchors, not line numbers)

- `scripts/gen-neighborhood-reference.mjs` — NEW (D1).
- `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/neighborhood-reference.json`
  — NEW committed table (D1); `structures-reference.json` +
  `structures-audit.md` — NEW committed audit artifacts (D6).
- `src/ui/NavComputer.js` — `_queryYRange` merge position fix (D2);
  constructor self-registration (D3). Seam-recorded for lane D above.
- `scripts/process-harris-catalog.mjs` — Part III parse + join + `radiusKpc`
  (D5); `public/assets/data/globular-clusters.json` — regenerated (D5).
- `src/generation/RealFeatureCatalog.js` — `radius: gc.radiusKpc ?? 0.03` (D5).
- `scripts/audit-structures.mjs` — NEW (D6); `src/data/KnownObjectProfiles.js`
  — corrections only where the audit demands (D6).
- `src/generation/RealSystemOverlay.js` — `resolve()` no-table snum hook (D7).
- `contract.json` — AC4 amendment + validate (D7); `representation-cap.md` —
  §5 implemented-note + new §6 (D7/D8).
- Tests: `src/generation/__tests__/RealSystemOverlay.pipeline.test.js`
  (AC3 vehicle rework + new snum cases),
  `src/generation/__tests__/StarSystemGenerator.overlay.test.js` (unchanged
  mechanism pins), `src/generation/__tests__/KnownObjects.test.js` idiom
  extended by the audit tests, NEW nav-merge + reference-gen + parser tests.
- **NO main.js edits planned** (D3 deliberately avoids one; the flagged count
  for lane B stays at four).
