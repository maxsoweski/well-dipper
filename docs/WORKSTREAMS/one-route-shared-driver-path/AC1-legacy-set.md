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
| `base/lidDisruption.js` | 2 test files import it; no front-end does. Coronae / diapir disruption profiles — a complete feature area with tests and no consumer. ⭐ **The clearest match to what Max described.** |
| `base/verify.js` | 1 test file. A dev utility, not a feature — different nature, same disuse. |
| `instrument/laws.js` | 1 test file, plus `scratchpad/` copies which are untracked throwaways. |

⚠ **`base/fieldViz.js` is NOT dead** and was nearly condemned: `worldengine-fieldviz.html` is its only
consumer and is a tracked third front-end. Omitting it from the front-end set would have produced a
false positive. The scan names all three front-ends explicitly for this reason.

## The 18 unreached laws — and they are not one kind of thing

- ⭐ **`base/emission-e.js` — `writeEmissionESphere`, `bakeEmissionEAttributes`.** The blackbody
  thermal emission register: a real feature, with a bake, wired to nothing. It is in the GAME's
  import closure and not the lab's (import-back debt row). **This is the strongest "developed, never
  connected" case in the set.**
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

## Open for Max

1. `lidDisruption.js` — delete as deprecated, or wire it?
2. `emission-e.js`'s two laws — wire (it is a real feature) or drop?
3. The `baseStep.js` four — delete as an unused API surface? No capability is lost.
