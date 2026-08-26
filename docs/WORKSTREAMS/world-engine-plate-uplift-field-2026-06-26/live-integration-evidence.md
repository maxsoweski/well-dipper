# Live-integration evidence — world-engine-plate-uplift-field-2026-06-26

**Driver:** working-Claude (main thread), chrome-devtools on GPU `:9223`, lab page
`http://localhost:5173/well-dipper/world-engine-lab.html` (the ~40k-node production lab mesh — NOT the
600/4000-node headless carriers). **Date:** 2026-06-26. Per the Dev-Collab OS, working-Claude drives
the objective live-integration checks; UAT (AC8) is Max's gate alone.

Instrumentation: `window._lab.plateProbe()` (added this increment) returns `{ heightSource, plateCount,
plateId[], boundaryClass[], U[], varExplainedByBoundaryDist, varExplainedByLatitude, riverStats }`. The
boundary-distance predictor is rebuilt inside the probe from the published `boundaryClass` labels via BFS
over the mesh adjacency (arm's-length — NOT the generator's internal field, matching the hardened AC2
headless gate). PRECONDITION satisfied: `reliefBakeStrength = 1` (bakedOn) so the router reads the
plate-written `carrier.height`.

## AC7 — bounded erosion routes/incises down the PLACED plate relief, not latitude (PASS)

Earth-like preset `Rocky (Earthlike)` (archetype → `terrestrial`), rivers enabled, routed.

| signal | seed 1 | seed 7 | AC7 bar | verdict |
|---|---|---|---|---|
| `heightSource` | `carrier` | `carrier` | == 'carrier' (single source, bakedOn) | ✅ |
| `plateCount` | 10 | 7 | plate partition active | ✅ (seed 7 = 7 plates, matches the headless prediction) |
| `varExplainedByBoundaryDist` | 0.394 | 0.640 | — | — |
| `varExplainedByLatitude` | 0.018 | 0.013 | — | — |
| **boundary-vs-latitude ratio** | **21.5×** | **49.2×** | boundary materially exceeds latitude | ✅ (carve follows plate-boundary uplift, NOT sin²(lat) bands) |
| `oceanFrac` | 0.35 | 0.35 | ~35% | ✅ |
| `orphanPct` | 0 | 0 | 0 | ✅ |
| `uphillPct` | 0 | 0 | 0 | ✅ |
| `selfLoopLand` | 0 | — | 0 | ✅ |
| `maxStrahler` | 6 | 5 | within band [≈5–6] | ✅ |
| `nanCount` | 0 | — | 0 (all finite) | ✅ |

`hMin/hMax/hMedian/seaLevel` (seed 1) = `-0.400 / 1.804 / 0.180 / 0.104` — relief band matches the
documented U range; the histogram sea-solver lands ocean at exactly 35%.

(a) heightSource == 'carrier' ✅ · (b) 0 uphill/orphan, trunks reach the sea, ocean ~35%, maxStrahler in
band ✅ · (c) variance explained by distance-to-boundary materially exceeds latitude (21–49×) ✅ ·
(d) shipped router-lab regression holds (ocean 35%, maxStrahler 5–6, 0 orphan/uphill) ✅.

## AC5 (live spot-check) — regime gate selects despun on a non-Earth-like body (PASS)

Switched preset to `Frozen (airless)` (archetype `ice`), re-routed, re-probed:
`plateProbe()` → `{ note: "despun path (non-Earth-like body) — no plate field", plateId: null,
heightSource: "carrier" }` — the gate took the **despun** path; no plate field was generated. Restoring
`Rocky (Earthlike)` returned `plateCount: 10` (plate path). Confirms the route()/lab regime gate live.

## Screenshots
- `scratchpad/plate-uplift-live/ac7-earthlike-seed1-close.jpeg` — Earth-like body at 2.6 radii: dendritic
  rivers (dark channels) cut into structured relief; not latitude bands. (Lab has all surface features on,
  so the pure plate field is overlaid by craters/dust/etc. — Max isolates that in UAT via the feature toggles.)

## AC8 — UAT (deferred to Max, never auto-PASSed)
See the verdict's summaryForMax and NOW.md for the exact walk-through.
