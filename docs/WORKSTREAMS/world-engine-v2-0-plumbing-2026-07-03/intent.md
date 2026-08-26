# world-engine-v2-0-plumbing-2026-07-03 — intent

## Why we care

Max signed off ROADMAP v2.1 (2026-07-03): the program is re-founded condition-first because
"every stagnant-lid world is a re-rolled Venus" — he wants condition **combinations** to produce
"predicted-but-never-observed" landforms, not re-rolls of the catalog. E1, the derived regime
selector that makes that possible, cannot exist until the planet's real conditions actually reach
the code that would read them. Today they don't: composition, age, radius, eccentricity, and shell
thickness all exist in the fingerprint (`_fp`) but stop at the lab; `baseStep`'s per-body scalar
derivations are internal locals of a dormant grid op; and the 17 driver-preset vectors live as an
inline literal in the lab HTML that tests string-scrape — so V2-1's conformance oracle would have
no headless source. V2-0 is the plumbing that fixes all three. **Zero visual change by contract** —
if any world looks different afterward, V2-0 has failed.

Line of sight: V2-0 → E1 (V2-1) → the pilot (V2-2) → "distinct, history-coherent worlds visible
per minute" (the program north star).

## DOES / UNLOCKS (Rule 15 card)

**DOES:** (1) threads the full body condition-vector (composition/density, age, radius,
eccentricity + raw tidal Io-ratio, shellThickness, plus surfacing D12/D13/D16/metallicity
data-only) from `_fp` through `route()`→`writeBodyRelief`; (2) refactors `baseStep.js` to export
its per-body scalar derivations as pure named helpers; (3) extracts `DRIVER_PRESETS` from
`world-engine-lab.html` into an importable module that lab AND tests consume. Data-only; no writer
consumes any new field yet (shadow-mode template from WS1: surfaced-but-not-consumed).

**UNLOCKS:** V2-1 E1 selector (condition vector at the seam + scalar helpers for Φ/L/Stage-A + a
headless preset source for the conformance oracle); Φ's size-aware d³ term (shellThickness
helper); `m_hp` computable on the production path (raw Io-ratio exposed); every later MULTIPLY
(V2-5s shell, V2-5 bombardment) reads the widened bundle at the tune seam.

## Success criteria (from the signed ROADMAP v2.1 — V2-0 row, §2.3, §7b #11, BU-M1/M2)

- Nothing shipped changes: every archetype-mapped preset renders byte-identically before/after;
  the full vitest suite stays green at the same count.
- `baseStep`'s scalars (thermalState, shellThickness, rawTidal/Io-ratio, radiogenic/size terms,
  radialStrain, liquidStability) are importable as pure per-body functions, pinned by the existing
  baseStep test suite; the `worldengine-fieldviz.html` harness (the one non-test caller) still works.
- `DRIVER_PRESETS` imports headlessly (17 entries, incl. Mars + Hot Jupiter), the lab consumes the
  module (no duplicated literal), and `planet-archetypes.test.js` imports it instead of
  string-scraping the HTML.
- The full condition-vector is present at the `writeBodyRelief` seam with `_fp`-derived values;
  tune builders receive the widened bundle and ignore unknown fields (`?? D_EARTH` discipline);
  `driversToTune(D_EARTH)` and `magmaDriversToTune(MAGMA_REF)` still return null.
