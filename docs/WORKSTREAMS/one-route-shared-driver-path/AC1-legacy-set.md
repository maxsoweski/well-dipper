# AC1 — the legacy set, named before anything moves

**Command:** `node tools/legacy-set-scan.mjs` · raw output committed as `legacy-set.txt`
**Measured:** 2026-08-22, branch `feature/world-engine-production-L1`

Max, 2026-08-21: *"we have develop features in world engine that are now legacy and not actually used
in the lod lab; i don't want to waste time on those."* This is that set. **"Unused" is measured;
"deprecated" is Max's call** — nothing here is deleted on this document's authority.

## Headline

**3 dead modules · 0 wholly-unreached modules · 18 unreached laws across 8 live modules.**

⛔ **THE FIRST RUN SAID 116 UNREACHED LAWS AND 4 WHOLLY-UNREACHED MODULES. BOTH WERE WRONG, AND THE
WRONG ANSWER IS RECORDED HERE BECAUSE IT IS THE MORE USEFUL ARTIFACT.** The four "wholly unreached"
modules were `rockySurface`, `solidOptics`, `solidFeatures` and `polarDeck` — **the shipped driver
packs B7 put in front of players**. Two compounding defects:

1. Same-file references were excluded, so a pack consumed through an exported `*_ENTRY` const that
   names its function in the same file looked unreferenced.
2. The fix for (1) did not work either: `String.match` **without the `g` flag** returns only the
   first match, so the new counter read `1` for every symbol and its guard never fired. The count
   only became real when the flag was added — `rockySurfacePack` went 1 → 6.

⭐ A legacy list that condemns shipped features is worse than no list. The scan now carries a control
that fires on a known-shipped pack, and the 116 was **inflation from a broken counter**, not signal.

## What the three tiers mean

| tier | count | what it is |
|---|---|---|
| **dead module** | 3 | no front-end imports it at all |
| **wholly unreached** | 0 | every law in a live module unreached — none exist |
| **unreached law** | 18 | an exported function in a LIVE module with no front-end consumer |

⚠ **A TEST-ONLY CONSUMER IS NOT A CONSUMER**, and that is the finding rather than an exclusion: work
that was done, proven correct, and never connected. Tests prove it works; they do not prove anyone
wants it.

## The three dead modules

| module | evidence |
|---|---|
| `base/lidDisruption.js` | 2 test files import it; no front-end does. ⭐ **AND THE REASON IS NOT NEGLECT — IT IS A LOSING PARALLEL IMPLEMENTATION.** The lab DOES do lid / corona / tessera work; it routes it through `stagnantLid.js` (`stagnantLidProbe`, planet-lod-lab.html:6013). So this is a SECOND expression of the same concept that nothing calls. ⛔ **Wiring it would author exactly the two-laws-for-one-thing disease this workstream exists to cure.** Deprecate. |
| `base/verify.js` | 1 test file. A dev utility, not a feature — different nature, same disuse. |
| `instrument/laws.js` | 1 test file, plus `scratchpad/` copies which are untracked throwaways. |

⚠ **`base/fieldViz.js` is NOT dead** and was nearly condemned: `worldengine-fieldviz.html` is its only
consumer and is a tracked third front-end. Omitting it from the front-end set would have produced a
false positive. The scan names all three front-ends explicitly for this reason.

## The 18 unreached laws — and they are not one kind of thing

- **`base/emission-e.js` — `writeEmissionESphere`, `bakeEmissionEAttributes`.**
  ⛔ **CORRECTED 2026-08-22. This was first written as "the strongest 'developed, never connected'
  case in the set" and that OVERSTATED it.** The module's core law is LIVE: `PlanetGenerator.js:4`
  imports `emissiveBlackbody` from it. What is unreached is the per-vertex SPHERE/BAKE path, which
  the current whole-globe `uEmissive` uniform supersedes (planet-lod-lab.html:2453 records the
  thermal pair replacing that stand-in). So this is a latent FIDELITY UPGRADE sitting behind a
  working simpler path — not an unwired feature. ⚠ The symbol-level scan cannot see this distinction
  and never could: it reports unreached SYMBOLS, and a module can be live through one export while
  another sits unused.
- **`base/baseStep.js` — `bodyAgeNorm`, `bodyThermalState`, `bodyRadialStrain`, `bodyLiquidStability`.**
  ⚠ **NOT legacy features.** The suite calls them *"thin named helpers — each returns one field of
  `deriveBodyScalars`, zero formula duplication"*, and `deriveBodyScalars` IS live. An API surface
  authored for a caller that never came. Deleting them removes no capability.
- **`instrument/descriptors.js`, `instrument/sampling.js` — 7 laws.** Measurement helpers. "No
  front-end" is close to expected for instrument code; these want a different question than the rest.
- **`base/band-flow.js`, `base/climate-e5.js`, `base/giant-drivers.js`, `drivers/giantDeck.js` — 5 laws.**
  Branches of live modules. `deriveGiantDriversForSeed` corroborates an existing in-source note at
  `port/conditionFromBody.js:835` that `deriveGiantDrivers` has no game-side caller.

## What this changes for the extraction

`applyDrivers` is 828 lines. Nothing in the three dead modules and none of the 18 laws should travel
into the shared pipeline. **The set is small enough that it does not threaten the extraction** — which
is itself the useful result: the fear that `applyDrivers` is mostly dead weight is not supported.

## Resolution — 2026-08-22, and it needed no ruling from Max

⛔ **THREE QUESTIONS WERE PUT TO MAX AND ALL THREE WERE ANSWERABLE FROM THE CODE.** Recorded because
the asking was the error, not the answers:

| | resolution | why it was decidable without him |
|---|---|---|
| `lidDisruption.js` | **deprecate** | the lab already does this work through `stagnantLid.js`; wiring it would create a second law for one concept |
| `emission-e.js`'s pair | **leave** | the module's core law is already live; the pair is a fidelity upgrade behind a working path |
| `baseStep.js`'s four | **leave** | zero stakes; `deriveBodyScalars` is live and no capability rides on them |

⭐ **THE TEST THAT MAKES ALL THREE OBVIOUS, and it is Max's own stated want:** none of these is *a lab
feature missing from the game*. The lab does not use any of them either. They are engine-side
leftovers, so they belong in neither this workstream nor the wiring follow-on. Applying his criterion
answers all three; asking him to apply it for me was the mistake.
