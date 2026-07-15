# real-star-identity-unification-2026-07-15 — intent

## Why we care

Max's AC9 verdict on `real-universe-overlay-2026-07-12` (2026-07-15, verbatim): **"It's a
FAIL — it partially works, minus the difficult legibility, in the PRISM view. But the SYSTEM
view doesn't match the PRISM view for binary/trinary systems today so that is not a pass."**

Max framed the defect as procgen-level, affecting main gameplay, not just nav: the same real
star currently generates **different systems depending on how you reached it** (search vs
prism click vs sky click carry different seeds), the nav SYSTEM view previews a third thing
that arrival never delivers (overlay-less local generation), and real stars without table or
archive data roll **fabricated stellar companions** (36 Ophiuchi — a real bound K-triple —
arrived as a fictional K+K tight binary with 4 planets after previewing 6 planets).

Line of sight: exploration-immersion. A real star must be ONE system, the same system, on
every path a player reaches it — and what the nav shows must be what warping delivers.

Root-cause record + solution plan (committed `882d121`, do not re-derive):
`../real-universe-overlay-2026-07-12/seed-identity-investigation.md`. Findings record:
`../real-universe-overlay-2026-07-12/ac9-uat-findings.md`.

## Max's rulings at scoping (2026-07-15)

1. **Fabrication reach = pin-by-default.** Un-tabled, un-hosted REAL stars never roll
   fabricated stellar companions; companion table + archive snum still win. Tradeoff accepted:
   real binaries not yet in the table render single until data grows — under-representation,
   never fiction.
2. **Lane-D render half folds IN** (N-dot glyph + label-declutter pass) under a Max-ratified
   NavComputer seam (Inc-4 AC2 search-overlay precedent; recorded for lane D). Max's finding-#1
   hard requirement stands: label readability — "no overlapping / hard-to-read labels."
3. **NEW workstream** — `real-universe-overlay-2026-07-12` stays `verified` with its complete
   verify record + AC9-FAIL recorded; its AC9 re-runs after this fix is live on `:5176`.

## Success criteria (Max's language)

- The same real star is the same system no matter how you reach it — search, prism click,
  sky click, or teleport all arrive at the identical system.
- The SYSTEM view matches the PRISM view — and both match what arrival actually delivers —
  for binary/trinary systems (and everything else).
- Real stars never get made-up stellar companions: no data → arrives single; the companion
  table and the exoplanet archive still win where they have data.
- "Every system marker shows the appropriate number of dots (procgen and real alike)" —
  multiplicity-honest prism markers (Max's finding-#1 ruling), never contradicting what
  warping delivers.
- "No overlapping / hard-to-read labels" at prism zoom (Max's hard requirement).
- The 36 Ophiuchi trio is one destination — an honest triple within the documented
  representation cap — reachable by any of its three names.

## Deliberate non-goals

- α Cen A/B planet fill: SHIP-AS-IS standing resolution (empty-is-realistic; populate knob
  stays available as authoring content).
- Planet FILL policy around real stars: already ruled (rep-cap §6, fill-ON) — untouched here.
- Catalog-derived multiplicity flags (HYG comp / WDS): successor territory; composes with
  pin-by-default later.
- Universe-wide empty-rate calibration, absent famous stars, structures authoring, seedtags:
  parked (unchanged).
