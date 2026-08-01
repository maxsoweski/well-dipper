# Increment 3 (AC3 + AC4) — build design

> Written 2026-07-13 by working-Claude before the build workflow; the build agents
> follow this design. Function + intent record per `record-build-intent`.
> Contract: `contract.json` AC3 + AC4 (+ AC8 guardrail). Do not widen scope.
> Ground truth from two read-only exploration passes over `d417a39` (facts below
> are code-verified, with point-in-time line refs — anchors are the symbols).

## What Increment 3 is (and is not)

The **bulk overlay merge**: every arrival at a real catalog star gets its real
contents — star type from the catalog, structure exactly where the curated
companion table covers it, known planets from the ingested archive data, procgen
deterministically filling the remainder (Elite as the guide) — plus the
supplement load that makes dim famous hosts (TRAPPIST-1; Proxima as its own sky
star) sky/nav/arrival-visible. NO new KnownSystems registry entries
(`findAt` at Sirius stays null — pinned by existing test); NO NavComputer/search
work (Increment 4); NO neighborhood reference table or structures audit
(Increment 5); NO new curated data beyond what Increment 1 shipped.

Pre-work landed at increment start: `d417a39` fixed the
ExoticOverlay._applyFungal 1-candidate bloom crash (binding input (b));
cadence-preserving clamp, TDD'd. D primaries are live via HYG's HD 15634
(spect 'D') and STAR_PROPERTIES.D from Increment 2.

## Code-verified facts the build MUST honor

1. **Two generation choke points, not three.** Nav-warp AND sky-click share
   `warpEffect.onPrepareSystem` (main.js:3436-3607): both set
   `warpTarget.navStarData` (nav ~2965-2972, sky-click `trySelectWarpTarget`
   ~10230/10266), so both take the `findByAlias(warpTarget.name, pos)` branch;
   miss → `StarSystemGenerator.generateAsync(seed, ctx)` (~3592). Teleport
   (`teleportToPosition` main.js:4972-5033): `findAt(pos)` → miss →
   `realStar = realStarCatalog.findByPosition(pos)`,
   `ctx.starTypeOverride = realStar.spect` (~5010), sync `generate` (~5012).
2. **ctx carries no star name.** `deriveGalaxyContext` (GalacticMap.js:935-1009)
   is position-only; `starTypeOverride`/`companionSpec`/`knownPlanets`/
   `farCompanions` are caller bolt-ons. The arrival star's NAME lives on
   `warpTarget.name` (warp) / `findByPosition().name` (teleport) — so the merge
   needs one thin edit per choke point; there is no zero-edit hook that sees
   the name. A position join instead would miss 104/116 bright hosts (Inc-1
   ruling 6, binding).
3. **RealStarCatalog is flat + async.** `load()` (RealStarCatalog.js:55-68)
   fetches hyg-stars.json (2.1 MB) into `_stars`, no indexes, O(n) finds;
   `load().then()` (main.js:250-262) wires StarfieldGenerator,
   `KnownSystems.associate(catalog, map)`, debug panel, nav. Supplement stars
   are NOT loaded by any runtime code today.
4. **Name forms.** HYG `name` = display form (15,560 usable; spect already
   single-letter incl. '?', 'N', 'p', 's', 'd', 'W', 'C', 'S', one 'D');
   supplement carries display `name` + archive `hostname` (bridge); contents
   host `name` = archive hostname, join-unique (0 dups). 116 contents hosts
   exact-match an HYG name; none maps to one of HYG's 12 duplicated names
   today. Near-pairs (HD 20781/20782, TOI-2267 A/B) have distinct names.
5. **Post-injection passes and what they do to a known planet** (in order,
   StarSystemGenerator._generateIterator): migration (L596-631) destroys
   (70% of scattered), reorders, retypes to hot-jupiter; resonance snap
   (L633-646) overwrites `orbitRadiusAU`; binary-stability cull (L651-662,
   `binaryStabilityLimit` PhysicsEngine.js:694) drops planets inside a_crit;
   ExoticOverlay.apply (L823) retypes via `_swapPlanetType`
   (ExoticOverlay.js:293-329) which REGENERATES planetData, discarding merged
   real radius/mass. None of these is known-aware today.
6. **The orbit-loop break can starve known slots.** `minInnerOrbitAU =
   separationAU*2.5` (L407) vs `maxOrbitAU` (L417): when it exceeds (A+B:
   58.75 > 50) the planet loop breaks at i=0 (L511) — BEFORE any slots exist.
   This, not the cull, is why Alpha Cen A+B is planetless.
7. **Spurious-binary exposure is the big one.** Only 3 of 4,457 contents hosts
   are companion-table-covered; non-table hosts leave the binary roll live
   (~35%), and 2,437 hosts have a planet inside 0.1 AU — a rolled binary's
   a_crit culls every tight known (TRAPPIST-1: 7 planets at 0.0115-0.0619 AU).
8. **Display names bypass the wrapper.** UI reads `system.names` /
   `_knownSystemNames` (main.js:3929-3966; NavComputer.js:279/286) — never
   wrapper `.letter`/`.name`/`.known`. Without a names object, merged systems
   render "Planet N" and AC3's real-designations observable fails.
9. **Seeds are position-derived and revisit-stable.** Hash-grid seed =
   `hashCombine(h, cx*31+cz*997)` (HashGridStarfield.js:389 et al.); warp
   passes `String(resolvedStar.seed)`. Same seed + same ctx → deep-equal
   (StarSystemGenerator.overlay.test.js:203 precedent).
10. **AC8 mechanics.** ProcgenSnapshot.test.js re-filter reads BOTH
    real-star-supplement.json and real-system-contents.json (L28-58) — the
    excluded set is fixed by already-shipped files; Increment 3 adds no new
    position file. Samples regenerate without overlay ctx. No test pins the
    15,599 catalog count (supplement concat is safe).
11. **star2 consumers are ready.** SystemMap/NavComputer/main.js star2 reads
    are all gated on `isBinary && star2`; a table binary fits with zero UI
    change (NavComputer 'D' swatch fallback is lane-D-flagged, cosmetic).
    `farCompanions` is read by no consumer (inert data, by design).

## Design decisions (binding)

**D1 — One lane-C module, two thin main.js call sites.**
`src/generation/RealSystemOverlay.js` (NEW) owns: contents/supplement data
access, the hostname index, the name-first join, and ctx-field population
(`applyToContext(ctx, starName)` or equivalent returning the same
companionSpec/knownPlanets/farCompanions shapes Increment 2 consumes). main.js
gets exactly TWO surgical edits, in the procgen ELSE branches that already set
`starTypeOverride`: warp (~3591) and teleport (~5008), each one call passing
the name it already has. Every other `generate()` call site (debug spawns,
find-nearest, gallery, snapshot) stays pure procgen — the AC8 gate is
structural. Both edits are coordinator-flagged (same class as Inc-2's D7).

**D2 — Name-first join.** Join key = the arrival star's catalog display name.
Index: contents hostname → host, plus the supplement display-name→hostname
bridge ('Proxima Centauri' → 'Proxima Cen'; 'Kepler-90' → 'KOI-351'). Companion
table joins by its entry `name` (display form). Position is a DISAMBIGUATOR
only, never the primary key: if the arrival name is one of HYG's duplicated
names, contents attach only to the same-named star nearest the host's ingested
position (deterministic); today's data has zero such overlaps and a test pins
that invariant. No position veto on unique-name joins (that would resurrect
the 104/116 failure).

**D3 — Known-planet immunity (binding input (c), resolved here).** Planets
injected from `ctx.knownPlanets` (`p.known === true`) are exempt from:
migration destroy/retype/reorbit; resonance snap (real smaAU wins; snap pairs
involving a known are skipped); the binary-stability cull
(keep `p.known || orbit > a_crit` at L656); and ALL overlay candidate lists
(civilized L70, fungal/exotic L118/152, geological L254 — skip `p.known` when
building candidates, which also preserves merged real radius/mass against
`_swapPlanetType` regeneration). Additionally the injection must GUARANTEE
known slots exist regardless of the orbit-loop break (fact 6): builder
verifies/restructures so `knownPlanets` slots are created even when
`minInnerOrbitAU > maxOrbitAU` or the rolled count is 0 — this is what makes
knowns-around-table-binaries work. Cadence: procgen systems carry no knowns,
so every guard is a no-op there by construction (Inc-2 fact-3 precedent);
merged systems need generate-twice determinism only.

**D4 — Structure stays table-only (contract-literal).** Non-table hosts get
procgen structure, including possible spurious binaries — their knowns survive
via D3; the physical oddity (tight real planets inside a rolled binary) is a
documented fidelity caveat (cap addendum). The archive `snum` field is NOT a
multiplicity source (the table is the single source of truth, post-review
ruling 6). Recorded as an AC9/UAT knob candidate alongside the Alpha-Cen
fill-policy knob: "treat contents snum==1 as an implicit single-pin" — parked,
Max decides at UAT. Table joins on the bulk path: Sirius/Procyon → forced D
companion (AC3/AC4c); Vega/Altair → binary roll suppressed (AC4d).

**D5 — Contents + supplement ride RealStarCatalog.load() (one Promise.all).**
`load()` fetches hyg + supplement + contents together; `_stars` = hyg ∪
supplement, concatenated BEFORE `associate()` runs (supplement stars become
findVisible/findInVolume/findByPosition targets; Proxima-inside-A/B resolves
via the alias-membership exemption already landed and tested in Inc 2).
The contents Map is built at load and handed to RealSystemOverlay. Binding
property: any arrival that resolved a real catalog star implies the contents
index is ready — same promise, no separate race, no await inside generate.
If the overlay is queried unready anyway it must `console.warn` (never
silently procgen — AC3 failures must be observable).

**D6 — Star type stays catalog-sourced.** `starTypeOverride` = catalog `spect`
on every path (never contents `spect`), routed through
`normalizeSpectralClass` defensively (fact 4's letter zoo; D first-class).
When a contents host joins, set `star.spectFull` from the host's `spectFull`
(merged systems only; key omitted otherwise — AC8 null-vs-omit).

**D7 — Display names for merged systems.** Build the names object the UI
actually reads (fact 8), mirroring `deriveAuthoredNames`: system/star = catalog
display name (already real via the naming workstream); star2 = table component
name ('Sirius B') when a table binary is present; known planets = archive
`pl_name` ('TRAPPIST-1 b' … 'h'), procgen fill keeps the existing letter
convention. Wired at the two D1 call sites through the same mechanism each
already uses for names; observable: nav/system UI shows real designations.

**D8 — Determinism + revisit.** No persistence changes: every arrival
re-resolves the star and rebuilds ctx from the same loaded data → same seed +
same ctx → deep-equal (fact 9). AC4's ×2 requirement is tested by building ctx
twice through RealSystemOverlay and generating twice, per case.

**D9 — Cap addendum.** `representation-cap.md` gains a short §5 "Bulk-merge
fidelity caveats": known planets keep archive orbits (resonance snap skips
them); a non-table host may roll a procgen companion around real planets
(structure honesty is table-scoped); D primaries carry 'main-sequence'
evolution labels (cosmetic); far-companion planets remain data-level.

## Deliverables

1. `src/generation/RealSystemOverlay.js` (NEW): load/index/join/ctx-builder +
   names derivation for merged systems.
2. `RealStarCatalog.js`: Promise.all load of hyg + supplement + contents;
   supplement concat before associate-wiring.
3. `StarSystemGenerator.js`: D3 immunity guards (migration, resonance, cull,
   slot guarantee). `ExoticOverlay.js`: `p.known` skips in all candidate lists.
4. `src/main.js`: TWO surgical lines (warp else ~3591, teleport else ~5008).
5. Names wiring (D7).
6. `representation-cap.md` §5 addendum.
7. Tests (`src/generation/__tests__/`):
   - `RealSystemOverlay.test.js` (NEW): join semantics (Sirius→companionSpec,
     TRAPPIST-1→7 knownPlanets with real params, no-data star→NO overlay keys,
     bridge names, dup-name discipline pin, unready-warn).
   - StarSystemGenerator immunity suite: each D3 pass exercised with knowns
     (forced binary + tight knowns survive; migration-prone giant + knowns;
     resonance chain keeps real smaAU; exotic candidate skip), ×2 deep-equal.
   - AC4 cases through the real pipeline (ctx via RealSystemOverlay +
     generate): (a) partial-knowns host procgen-fills (builder picks a host+
     seed where rolled > known deterministically, pins it); (b) zero-data HYG
     star (e.g. Betelgeuse) → catalog type + pure procgen ×2; (c) Sirius →
     'D' star2 @19.8 AU ×2; (d) Vega → no companion ×2.
   - Supplement-load tests: TRAPPIST-1 findByPosition/visible; Proxima still
     resolves to Alpha Centauri (alias, not own arrival); catalog size
     15,599+14.
   - AC8: ProcgenSnapshot untouched and green; full suite from the REPO dir;
     baseline 1278 grows, never shrinks.

## Non-goals (deliberate)

- No new KnownSystems registry entries; `findAt(Sirius)` stays null (pinned).
- No NavComputer edits (lane D; Increment-4 seam is coordinator-routed).
- No neighborhood-reference table (Inc 5), no structures audit (Inc 5).
- No snum-based multiplicity, no bulk far-companion synthesis (table-only).
- No eccentric-orbit rendering; no third-close-star slot (cap doc stands).
- No namedSystemsCatalog regen unless the collision check fires.
- No save/share persistence work (no full-systemData store exists).

## Lane etiquette

Lane-C-owned files throughout (`src/generation/**`, its tests, this dir),
except the TWO surgical main.js lines (D1) — flagged to the coordinator in the
seam handoff, same class as Inc-0/Inc-2's flagged edits. Zero NavComputer
edits; zero lane-D GalacticMap regions.
