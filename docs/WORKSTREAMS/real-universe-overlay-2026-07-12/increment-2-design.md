# Increment 2 (AC10 + AC5) — build design

> Written 2026-07-13 by working-Claude before the build workflow; the build agents
> follow this design. Function + intent record per `record-build-intent`.
> Contract: `contract.json` AC10 + AC5 (+ AC8 guardrail). Do not widen scope.
> Ground truth from two read-only exploration passes over `985a900` (facts below
> are code-verified, with point-in-time line refs — anchors are the symbols).

## What Increment 2 is (and is not)

Two capabilities, engine-side: **AC10** — the engine can represent observed
stellar structure (class-D star end-to-end, overlay generation-context fields,
far-companion representation, explicit representation cap); **AC5** — the
data-driven KnownSystems authoring path, proven by Alpha Centauri. NO bulk
overlay merge (Increment 3), NO RealStarCatalog supplement loading (Increment
3), NO NavComputer/search work (Increment 4), NO new curated data typed by hand.

## Code-verified facts the build MUST honor

1. **The G-fallback is one site:** `StarSystemGenerator.js:157-161` — unknown
   `starType` warns `[SSG] Unknown star type "X", falling back to G`. Two remap
   tables run first (`EVOLVED_TYPE_MAP` Kg/Gg/Mg, `UNUSUAL_TYPE_MAP` W/C/S).
   Rendering does NOT re-derive from the letter: `spawnSystem` (main.js ~4376)
   feeds `StarFlare`, which reads only pre-baked `color` + `radius`. The
   `WhiteDwarfStar` class in `src/rendering/objects/StarRenderer.js` is DEAD
   code (`createStarRenderer` imported, never called) — do NOT wire it.
2. **Null-vs-omit is the AC8 ballgame:** `ProcgenSnapshot.test.js` deep-equals
   the ENTIRE systemData after a `JSON.stringify` round-trip; stringify keeps
   `null`, drops `undefined`. New systemData fields must be **omitted** (key
   never set) on procgen-only systems. `star2:null` is baselined and stays.
3. **RNG cadence:** per-planet child streams are seeded from the advancing main
   stream (`rng.child(\`planet-${i}\`)` = 1 main draw; spacing `logNormal` = 2).
   All overlay behavior is gated behind ctx fields procgen systems never carry,
   so procgen draw order is untouched by construction. Within overlay/authored
   systems the requirement is determinism (generate twice → deep-equal), not
   pre-overlay equality; clean branches are fine there.
4. **`star2` is a CLOSE-binary slot** consumed by spawnSystem/StarFlare,
   NavComputer, SystemMap, GravityField, ShipCamera — all gated on
   `isBinary && star2` with `binarySeparation*`/`binaryMassRatio`/
   `binaryOrbitSpeed`/`binaryOrbitAngle` sibling fields. A+B (23.5 AU) fits
   this slot with zero consumer changes; Proxima (13,000 AU) does NOT — the
   far-companion field is greenfield.
5. **Name joins are load-bearing:** A/B catalog names are "Rigil Kentaurus" +
   "Toliman" (HYG; ~0.001 pc apart, both 1.32 pc from Sol); far companion is
   "Proxima Centauri" (supplement `name`) whose planet-host key is
   "Proxima Cen" (contents `name`; supplement carries the `hostname` mapping).
   `associate()` claims from HYG only → Proxima is NOT auto-aliased.
6. **Companion classes are multi-char** ('DA2', 'G2V', 'M5.5Ve');
   `STAR_PROPERTIES` is keyed by single letters. Normalize before lookup.
7. **Exactly two existing tests flip** (both anticipated in-file):
   `KnownSystems.match-radius.test.js` "does NOT match Sol at Rigil Kentaurus"
   (a1d2d4c successor flag 1) and `RealUniverseIngest.test.js` "every entry
   clears MATCH_RADIUS from every KnownSystems position" (needs the
   companion-table-derived exemption, mirroring Increment-1 post-build ruling 2
   — its header already documents the intent). The full-catalog sweep stays
   green automatically once associate() aliases Rigil/Toliman.
8. **KnownSystems entries bypass StarSystemGenerator today** (Sol hand-builds
   via `generateSolarSystem()`); all three arrival paths call
   `knownWarp.generate()` and use `_knownSystemNames` verbatim (skipping
   `generateSystemNames`), so a data-driven entry needs NO main.js edits on the
   spawn side.

## Design decisions (binding)

**D1 — Authored entries route THROUGH StarSystemGenerator.** The data-driven
`generate()` builds a real `galaxyContext` for the entry position, attaches the
overlay fields, and calls `StarSystemGenerator.generate(entry.seed, ctx)`. One
engine, one code path: AC10's ctx support serves both AC5 now and Increment 3's
bulk merge later. Sol's hand-written path is untouched (Sol IS the legacy path;
always-test-Sol).

**D2 — Overlay ctx fields, mirroring the `starTypeOverride` bolt-on idiom:**
- `ctx.companionSpec` — a `STELLAR_COMPANIONS`-shaped entry (`kind`,
  `components`, `farCompanions?`). `kind:'multiple'` → forced binary: star2
  type from leading-letter-normalized `components[1].class`, `binarySeparationAU`
  from the table, massRatio derived from the two types' `radiusSolar^1.25`
  (deterministic), Kepler orbit speed, rng orbit angle. `kind:'single'` →
  binary roll suppressed (AC4d's pinned-single machinery lands now).
  Keep the full class string on `star2.spectFull` (and `star.spectFull` when
  known) for display honesty.
- `ctx.knownPlanets` — archive-shaped list (`letter,name,periodDays,smaAU,
  massEarth,radiusEarth,eccen`, numerics nullable). Injection: known planets
  sorted by smaAU (derive missing smaAU from periodDays via Kepler + star
  mass; both-null → after last known) occupy the first slots of the planet
  loop with `orbitRadiusAU = smaAU` and real `radiusEarth`/`massEarth` merged
  onto `planetData` after `PlanetGenerator.generate` (procgen fills type,
  palette, atmosphere, moons deterministically); remaining slots stay procgen,
  orbits continuing outward from the last assigned orbit;
  `planetCount = max(rolled, known.length)`. Wrapper gains `letter`, `name`,
  `known:true`, and `eccen` ONLY on injected planets (omitted otherwise —
  fact 2). Real `eccen` is carried as data; rendered orbits stay circular
  (documented caveat, representation-cap doc).
- `ctx.farCompanions` — list of `{name, class, separationAU, planets?}`;
  emitted as `systemData.farCompanions` (same shape + normalized `type`
  letter), **omitted entirely when absent**. Far-companion planets stay
  archive-shaped v1 (data-level representation; no scene body — see cap doc).

**D3 — Class D becomes a first-class STAR_PROPERTIES row, override/spec-only.**
White-dwarf params (color blue-white ≈ [0.85,0.9,1.0] matching the dead
renderer's palette; radiusSolar ~0.01; temp ~25000; luminosity ~0.05;
planetRange [0,2]; mapRadius small but HUD-visible — builder picks exact
values, cites a source comment). NOT added to `STAR_WEIGHTS` or
`COMPONENT_STAR_WEIGHTS` (procgen can never roll it; it enters only via
override/companionSpec — Elite-style honesty comes from data, not dice).
A shared `normalizeSpectralClass(str)` helper: existing remap tables first
(exact match, preserves Kg/Gg/Mg), then leading letter if in
O/B/A/F/G/K/M/D, then W→O, C→M, S→K by leading letter, L/T/Y→M, else null
(caller falls back to existing warn path). `_deriveCompanionType` gets an
explicit guard for a primary outside `SPECTRAL_SEQUENCE` (clamp to 'M') —
currently masked by the G-fallback, unmasked once D is first-class.
`RealStarCatalog.SPECTRAL_COLOR` gains a 'D' entry (C-owned, Increment-3
future-proofing). NavComputer's `_SPECTRAL_COLORS` is lane-D-owned — NOT
touched; flagged in the handoff instead (cosmetic swatch fallback only).

**D4 — Alpha Centauri registry entry is declarative and duplication-free:**
```js
{ name: 'Alpha Centauri',
  position: { x: 8.000948, y: 0.024984, z: -0.000924 },   // Rigil's HYG record
  seed: 'alpha-centauri',
  data: { companionsRef: 'Alpha Centauri' } }              // key into STELLAR_COMPANIONS
```
The adapter (`src/generation/KnownSystemAuthoring.js`, NEW) resolves
`companionsRef` → components/farCompanions from `STELLAR_COMPANIONS` (single
multiplicity source of truth — the entry carries NO classes/separations), and
far-companion planets from the generated contents module (D5). It builds ctx
(D2), calls StarSystemGenerator, decorates `_destType`/`_isKnownSystem`/
`_knownSystemName`, and derives an index-aligned `names` object:
`system` 'Alpha Centauri', `star` 'Rigil Kentaurus', `star2` 'Toliman',
procgen-filled planets named by the same letter convention procgen uses
(nothing hand-written). Builder MUST check spawnSystem's names consumption
(main.js ~3930/~4355) and produce safe moon entries for procgen moons (Sol
names all moons; empty/missing moon names must not break labels).

**D5 — Far-companion planets come from a generated module, not runtime fetch
and not hand-typing:** `scripts/gen-known-system-contents.mjs` (NEW, ingest
idiom: pure, deterministic, byte-identical re-runs, self-checked, exits
nonzero on failure) reads `real-system-contents.json` +
`real-star-supplement.json`, resolves requested display names → hostnames via
the supplement mapping ('Proxima Centauri' → 'Proxima Cen'), and emits
`src/generation/data/knownSystemContents.generated.js` (tiny: just the hosts
authored entries reference). A vitest drift guard re-derives the extraction
from the JSONs and deep-equals the module. Keeps `generate()` sync and the
bundle small; remains valid after Increment 3 (same archive data, derived).

**D6 — Aliases: Proxima is claimed via the companion table, not hand-listed.**
At entry init/associate, far-companion names from the resolved companion entry
are added to the entry's aliases (+ alias index). Rigil/Toliman arrive
automatically via `associate()` (HYG). Result: alias set = {Alpha Centauri,
Rigil Kentaurus, Toliman, Proxima Centauri} — AC5's observable, and the
future-proofing for when Increment 3 loads the supplement into the catalog
(a supplement Proxima inside A/B's MATCH_RADIUS must read as alias membership,
never a swallow).

**D7 — Map access for ctx:** extend the existing call site
`KnownSystems.associate(realStarCatalog)` (main.js ~258) to also hand over the
GalacticMap instance (ONE surgical line — the only main.js edit in this
increment; flag in the seam handoff). Test fallback: adapter may construct
`new GalacticMap('well-dipper-galaxy-1')` (ProcgenSnapshot precedent) when no
instance was injected; a test pins that the literal matches main.js's.

**D8 — Representation cap doc:** `representation-cap.md` in this workstream
dir, cited by the new tests: at most 2 close stars per system (`star`+`star2`);
wide companions = `farCompanions` data field (arrival still resolves to the ONE
authored/merged system via alias membership / findAt) or adjacent real systems;
closer higher-order multiples collapse to the brightest pair with a written
caveat; far-companion planets are data-level v1 (no scene body; the far
companion's sky presence is its own real catalog star once Increment 3 loads
the supplement); real `eccen` carried as data, orbits rendered circular.

## Deliverables

1. `StarSystemGenerator.js`: `STAR_PROPERTIES.D`, `normalizeSpectralClass`,
   companionSpec/knownPlanets/farCompanions consumption, `_deriveCompanionType`
   guard. `RealStarCatalog.js`: 'D' color row.
2. `src/generation/KnownSystemAuthoring.js` (NEW adapter) +
   `scripts/gen-known-system-contents.mjs` (NEW) +
   `src/generation/data/knownSystemContents.generated.js` (generated).
3. `KnownSystems.js`: declarative-entry support (`seed`/`data`), Alpha
   Centauri entry, far-companion alias derivation, map injection.
4. `representation-cap.md` (this dir).
5. Tests: new `StarSystemGenerator.overlay.test.js` (class-D no-warn spy;
   injected known planets carry designations, procgen fills rest, twice →
   deep-equal; farCompanions shape; omitted-when-absent: procgen ctx system
   has NO overlay keys — JSON round-trip key check; single-pin suppression),
   new `KnownSystemAuthoring.test.js` (Alpha Cen: star G + star2 K from the
   table, farCompanions[0] Proxima with planets b,d matching the contents
   JSON values; names index-aligned; aliases all three; findAt at Rigil AND
   at Proxima's supplement position → Alpha Centauri; entry carries no
   multiplicity data; determinism ×2; generated-module drift guard), the two
   flips (fact 7), belt/sweep/Sol suites untouched and green. Full suite from
   the REPO dir; baseline 1249 passed grows, never shrinks.

## Non-goals (deliberate)

- No overlay MERGE (joining arbitrary real arrivals to contents data) — Inc 3,
  which MUST join by NAME first (Increment-1 post-build ruling 6, binding).
- No RealStarCatalog supplement loading, no sky/nav appearance for Proxima yet.
- No NavComputer edits (lane D; 'D' swatch flagged, not fixed).
- No WhiteDwarfStar/createStarRenderer wiring (dead code stays dead).
- No Sirius registry entry (stays overlay-merge path; findAt(Sirius) stays null
  — pinned by existing test).
- No third-close-star slot; no eccentric orbit rendering.
- three.js library-context brief deliberately NOT refreshed: the live render
  path consumes pre-baked color/radius data only; no three.js API surface is
  touched (checked against the handoff's flag).

## Live-verification note

:5176 confirmed DOWN this session (browser-level check). AC5's live arrival
drives + the owed AC8 `enterSol()` 19/19 defer to the next dev-server session,
per the Increment-1 precedent. Headless layers (all of AC10, AC5's suites)
verify now.

## Lane etiquette

Lane-C-owned files throughout, except ONE surgical main.js line at the
existing `associate()` call site (D7) — flagged to the coordinator in the seam
handoff. Zero NavComputer/GalacticMap-rendering edits.
