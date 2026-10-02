# Phase 0 — what actually costs 3 s on entering PRISM (AC-0)

Measured 2026-10-02 in the live game (lane A, `feature/world-engine-production-L1` @ `7554b70`, Chrome 154 on Windows, debug port 9223, `http://localhost:5175/well-dipper/`, page freshly reloaded before measuring). No source file was edited. All instrumentation was patched onto the live objects with `evaluate_script` and removed by a reload. Scripts are listed at the end.

Labels: **[M]** measured in this session. **[I]** inferred from the measurements or the code.

---

## 1. Plain-English summary (for Max)

**What is slow.** When you open PRISM, the nav fills in a tall column of stars, from 3 kpc below the galactic plane to 3 kpc above it, in 100 pc steps. At each step it asks the star generator "which stars are in this box?" To answer, the generator checks every small grid cell in the box, and for each cell it works out how dense the galaxy is at that point. That density sum is the expensive part: it evaluates the spiral-arm formula 7 times per cell, and each evaluation loops over all 6 arms. **About 62% of all CPU time is that one spiral-arm function** (`_spiralPotentialOnly`).

**Why XIGMAG was so much worse than other places.** The box gets wider wherever the galaxy is thinner. The nav sizes the box so that it holds about 150 stars, so in a sparse region the box grows. Then the code uses that size as a *half*-width, so the box is twice as wide as intended. XIGMAG-2AE101GKK2 is not near the core. It is at **R = 17.0 kpc, past the edge of the visible disk** (the disk ends at 15 kpc), where stars are very sparse. Its box is **76.8 pc wide**, compared with 20.7 pc at Sol, so each 100 pc step checks **728,000 cells against Sol's 65,000**. That means about 2 s per step, two steps per frame, and the game freezes for **~4 s per frame, 32 times in a row: about 2 minutes** before the column is complete.

**Why the headless test said 0.2 s.** It measured different places (Sol and the inner galaxy), where the box is small. When I give node the exact box the browser used at XIGMAG, node takes 1.3 s. Chrome takes 2.0 s for the same call. Chrome on this PC is uniformly about 1.5–1.65× slower than node at this kind of math, and a plain math loop shows the same ratio. **So the 15× gap is ~10× "different box" times ~1.5× "different JavaScript engine".** It is not caused by the profiler: with the profiler on, the steps were no slower.

**Can option D's thin slab stay under 50 ms?** The slab is 7.8125 pc × 7.8125 pc × 100 pc. **The query itself, yes: 22–31 ms everywhere** (max 33 ms) once the galaxy's feature lists are cached. On a cold cache, though, it is 55–71 ms at the inner galaxy and at Sol, and naming the slab's stars adds another 12–43 ms in dense places. So **one slab done in one go does not reliably fit under 50 ms**. However, all of the work is made of small repeatable pieces (about 3 µs per cell and about 2 µs per star name), so the Phase 3 loader can cut it into 8 ms bites. **Decision 0 does not need reopening, provided the loader slices *inside* a slab, not slab-by-slab.**

**One more finding.** The cockpit's nav screen and the pop-up nav each load their own column, and both can run at once. The cockpit's loading also keeps running after you leave HELM.

---

## 2. Today's PRISM entry — the numbers [M]

Design 1 (`viewMode 'rail'`), overlay NavComputer, entering PRISM from REGION with a synthetic Tab on `document`.

| | XIGMAG-2AE101GKK2 | Sol |
|---|---|---|
| Galactic position (game) | (-11.7678, 0.08008, -12.2816) kpc, **R = 17.01 kpc**, seed 694060861 | (8, 0.025, 0) kpc |
| `_localCubeSize`, passed as `xzHalf` | 38.38 pc → box **76.8 pc** wide | 10.34 pc → box 20.7 pc wide |
| Initial sync query (y ±6 pc) | 242 ms (cold), 236–269 ms warm; 106,386 cells; 93,279 density calls | 58 ms cold, 24–25 ms warm; 9,586 cells; 7,764 density calls |
| Cells per 100 pc background query | **728,424** (M tier alone 468,813) | 64,792 (M tier 41,013) |
| Density calls per 100 pc query | **728,330–730,512** | 59,132–62,076 |
| `_spiralPotentialOnly` calls per query | 5.10–5.11 M (exactly 7 per density call) | 413,924 (7×) |
| `findStarsInPrism` per 100 pc query | **1.86–2.18 s** | 159–220 ms |
| Background callback (2 queries) — cold, no profiler | median **3,859 ms**, max 4,074 ms | median 316 ms, max 405 ms |
| — warm, no profiler | 3,962–4,112 ms | 326–389 ms |
| — warm, **performance trace running** | 3,498–3,816 ms | — |
| — warm, density counters on | 4,090–4,207 ms | — |
| — design 2 (`'bars'`), warm | 3,990–4,086 ms | — |
| Callbacks to fill ±3 kpc | 32 (each one long task > 50 ms) | 32 (31 long tasks > 50 ms) |
| Total main-thread time / wall time to full | 115.6 s / **116.6 s** | 9.7 s / 10.8 s |
| Final rows | **63,924** (matches 2026-09-30 exactly) | 43,681 |
| Naming + real-star merge (whole column) | 214 ms (`_queryYRange` 115,854 ms − `findStarsInPrism` 115,640 ms) | 166 ms |

**Profiler overhead [M]:** none was detectable. Steps ran 1.73–1.94 s with the trace recording and 1.96–2.10 s without it, a difference inside run-to-run noise. The 2026-09-30 "3.1 s frames" are the same phenomenon. Today's frames are 3.5–4.2 s.

**Trace self-time [M]** (21.5 s sampled, `trace-xigmag-design1.json.gz`): `_spiralPotentialOnly` (GalacticMap.js:844) **62.1%**, `spiralArmStrength` (:402) 6.6%, `nearestArmInfo` (:434) 6.5%, `potentialDerivedDensity` (:682) 4.7%, `findStarsInPrism` loop body (HashGridStarfield.js:640) 3.2%, idle 5.8%.

## 3. The dominant cost

- **Per cell:** one `potentialDerivedDensity` call (HashGridStarfield.js:689), made only for cells that survive the bounds tests (:679-684), not once per loop visit. Its numerical Laplacian (GalacticMap.js:755-781) calls `_spiralPotentialOnly` 7 times (:770-776), and each of those loops over **6 arms** (`gm.arms.length` = 6 [M]) with `log`, `cos`, `cosh`, `exp` and `pow` (:851-866). Cost in Chrome ≈ **2.8 µs per density call at XIGMAG and 3.0 µs at Sol [M]**. Cost scales with density calls, and density calls ≈ cells.
- **Control [M]:** in the bulge (R = 0.3) the Laplacian is skipped (`R > 0.3`, GalacticMap.js:755) and `_spiralPotentialOnly` returns 0 below R = 0.5 (:845). The same slab there costs **4 ms instead of 25–30 ms**, so the spiral term is most of the per-cell cost.
- **Why XIGMAG has 11× Sol's cells [M + code]:** `_localCubeSize = max(0.003, _computeTileSize(x, z, 150))` (NavComputer.js:1188, :4678). `_computeTileSize` documents its return value as a **tile width** (:1593), sized to hold 150 stars at mid-plane density (:1595-1601). `_ensureStarsLoaded` stores it as `blockHalf` (:3698), and `_queryYRange` passes it as **`xzHalf`** (:3750-3751). The box is therefore 2× wider than the 150-star cube, which means 4× the area (728,424 / 64,792 = 11.24× Sol's cells at XIGMAG). The query is not the only consumer that reads the value as a half-width: the PRISM pan clamp (:1404), the prism draw (`cubeHalf`, :3549) and the grid extent (:1999) do too, so a fix has to change all of those consumers together, not just the query. Lower density makes the cube wider, and cells grow with the square of the width:

  | Location (node, warm, 100 pc step) [M] | half-width | box | cells/step | node ms |
  |---|---|---|---|---|
  | bulge R=0.3 | 3.0 pc (floor) | 6 pc | 8,808 | 4 |
  | inner R=1.5 | 3.0 pc (floor) | 6 pc | 8,808 | 8 |
  | R=4 | 6.2 pc | 12.4 pc | 26,152 | 35 |
  | Sol R=8 | 10.3 pc | 20.7 pc | 64,792 | 95 |
  | R=12 | 15.1 pc | 30.1 pc | 127,208 | 172 |
  | R=14 | 18.9 pc | 37.8 pc | 198,152 | 281 |
  | **XIGMAG R=17.0** | **38.4 pc** | **76.8 pc** | **728,424** | **990** |

- **Not the cost [M]:** naming plus the real-star merge come to ~0.2 s per whole column. Sorting *one slab* by distance is under 1 ms, but that is not what a publish costs: `state.js:986-1010` copies and re-sorts **every** loaded row each time `_localStars` grows, and a NAME sort (`localeCompare`) over 64k rows is 28 ms in node, ~45 ms in Chrome [I, ×1.6] (distance sort 4.9 ms; 6k rows < 2 ms in any mode) [M, node, `verify/rebuild-cost.mjs`]. Multiplicity is a separate per-new-row cost (§7.3). `findNearbyFeatures` runs once per query, and at XIGMAG it finds 0 features.
- **Correction to the AC text:** the AC calls XIGMAG "near the core". It is at R = 17.0 kpc, beyond `GALAXY_RADIUS` = 15 (GalacticMap.js:89) and inside the 1.2× query cut-off (HashGridStarfield.js:684). It is in the sparsest part of the disk, which is exactly why its box is the widest.

## 4. Browser vs headless — the 15× gap explained

| Same call, same bounds | Chrome (live page) [M] | node 24 [M] | ratio |
|---|---|---|---|
| XIGMAG 100 pc step (`xzHalf` 0.03838, `yHalf` 0.05, centre y 0.02408) | 2,004–2,040 ms (direct call); 1.86–2.18 s inside the nav | 1,276–1,329 ms | 1.5–1.6× |
| Sol 100 pc step (`xzHalf` 0.010336, `yHalf` 0.05, centre y −0.031) | 181–209 ms | 119–139 ms | 1.4–1.6× |
| Identical output? | 1,107 / 2,305 stars | 1,107 / 2,305 stars | ✓ |
| Identical density calls? | 728,330 / 59,132 | 728,330 / 59,132 | ✓ |
| Pure-math loop (`mathbench.js`, 3 M iterations of pow/cosh/cos/log/exp) | 249–261 ms | 152–157 ms | **1.65×** |

1. **Box size (~10×) [M].** The earlier headless probes (`scratchpad/prism-probe.mjs`, `prism-full.mjs`) measured Sol, R = 0.8, 1.5, 3 and 12. None of them was at R = 17. Their worst slab was the Sol-sized box. On identical bounds, browser and node run the identical query: same stars, same density calls.
2. **Engine/host (~1.5×) [M ratio, I cause].** The 1.5–1.65× factor is the **observed** ratio on this PC, not a floor. Chrome on Windows is 1.5–1.65× slower than node in WSL at the same math, both inside this query and in a standalone math loop. The likely causes are a different V8 build or different Math intrinsics. That cause is not proven. What is measured is that the ratio is uniform, so it is not caused by the query. Caveat: the node replay does not load the real feature catalogue that the browser wires up (`main.js:323`). Star counts and density-call counts still matched exactly, so any extra browser work there is probably small, but this split explains direct query calls only, not whole frames.
3. **Not the profiler [M]:** steps were no slower with the trace running (§2).
4. **Not cache warmth [M]:** the first-ever query differs from warm ones by < 10% at XIGMAG (2,072 vs 1,962–2,104 ms). A cold feature-region cache adds a one-off 7–42 ms (§6), which is small next to 2 s.
5. **Not the instrumentation [M]:** the counter-only wrappers added ~5%. The timing runs had no wrappers on the density path.

## 5. How many nav instances load at once [M]

- **Two instances exist:** the overlay (`_canvas` inside `#nav-computer-overlay`) and the cockpit NAV panel (`window._cockpitNav()`). Both run the same `_queryYRange` → `findStarsInPrism` with the same box (`xzHalf` 0.03838 at XIGMAG).
- In ORRERY only the overlay loads: 62/62 queries came from the overlay. In HELM, `N` does not open the overlay, and the cockpit instance at PRISM loaded alone: 4,082–4,223 ms callbacks.
- **Both load at once (measured):** I put the cockpit at PRISM in HELM, pressed `M` back to ORRERY, opened the overlay and entered PRISM. The cockpit's background chain **kept running while not rendered**, and callbacks alternated cockpit/overlay: `c3851 o4015 c3882 o3945 c3901 o3883 o3922 c3920 o3904`. The doubled column fill is ~4 min of 4 s freezes. Cause in the code: the overlay's `deactivate()` cancels its chain (NavComputer.js:625 `_resetPrismLoad`), but the cockpit instance is never deactivated (`main.js:5954` deactivates only `_domNavComputer`), and `_scheduleBgExpand` (:3854-3883) does not check whether its instance is visible.
- Side observation [M]: pressing `N` in HELM zoomed the cockpit NAV. After `M` to ORRERY that zoom stayed stuck (`zoomedRole 'NAV'`, `moverState 'toRest'`, not rendering), and `N` then did nothing until I went back to HELM. The 4 s frames may have caused it. It is unconfirmed and outside this AC.

## 6. Option-D slab benchmark (7.8125 × 7.8125 × 100 pc, in the browser) [M]

`xzHalf` = 0.00390625, `yHalf` = 0.05. "today" is the live `findStarsInPrism`. "corrected" is a copy of it that keeps a cell when its *extent* overlaps the box rather than when its *centre* is inside 1.1× the box (HashGridStarfield.js:679-681, the bright-star defect, plan §8). "Cold cache" means a fresh `GalacticMap` instance, so its feature-region cache is empty. The extent test is not the corrected copy's only change (`optionD-bench.js:27-29`): it also pads each tier by one cell on each axis (cells *visited* per slab 13,680 → 23,620), raises the skip limit from 200 to 201, and counts calls inside the timed loop (`:35`, `:45`). Density calls still rise only ~10%, so the "~10% more cost" reading holds. Warm figures are the median and max of 7 runs.

| Location | query | cold cache | warm median / max | stars | density calls | bright (O, B, giants) |
|---|---|---|---|---|---|---|
| inner R=1.5 (1.5, 0, 0) | today | **70.7** | 27.6 / 30.0 | 5,572 | 8,806 | 10 |
| | corrected | **69.3** | 30.8 / 32.1 | 5,654 | 9,700 | 10 |
| inner R=1.5 (0, 0, 1.5) | today | **68.6** | 26.5 / 27.3 | 5,694 | 8,806 | 25 |
| | corrected | **65.7** | 27.1 / 31.2 | 5,765 | 9,700 | 25 |
| bulge R=0.3 (0.3, 0, 0) | today | 40.9 | 4.0 / 4.5 | 6,667 | 8,702 | 10 |
| | corrected | 40.4 | 4.4 / 4.9 | 6,778 | 9,864 | **19** |
| Sol column (8, 0.025, 0) | today | **54.7** | 29.2 / 30.3 | 307 | 8,964 | 1 |
| | corrected | **55.1** | 30.9 / 33.0 | 313 | 9,722 | **4** |
| XIGMAG (-11.77, 0.080, -12.28) | today | 32.2 | 22.6 / 26.4 | 11 | 8,889 | 0 |
| | corrected | 30.1 | 26.5 / 28.9 | 11 | 9,957 | 0 |
| inner R=1.5, y = 2.5 kpc | today | **61.0** | 25.1 / 25.3 | 375 | 8,806 | 0 |
| | corrected | **65.8** | 27.9 / 28.4 | 380 | 9,676 | 0 |

**Where the "cold" cost comes from (after a fresh page reload) [M]:** `findNearbyFeatures` (0.5 kpc radius, HashGridStarfield.js:645) on an empty cache took **42.4 ms** at inner R=1.5 (17 features), 37.9 ms at (0, 0, 1.5), 37.5 ms in the bulge, 27.9 ms at Sol and 6.9 ms at XIGMAG. It generates up to 27 feature regions of 4 kpc (GalacticMap.js:1590-1610, :1426), with up to 512 density samples each. The cell scan that follows took 24–32 ms even as the first `findStarsInPrism` call after reload (3.9 ms in the bulge). The JIT for the density functions is already warm from the game's boot (sky generation), so a first PRISM entry is not JIT-cold.

**Work after the query, per slab [M]:** `generateSystemName` for each row (what `_queryYRange` does at NavComputer.js:3759) took 43.3 ms the first time and 11.8–18.8 ms warm for the 5,572 stars at inner R=1.5. That is about 2.0 µs per star warm. It took 13.3–15.6 ms for 6,667 bulge stars and 0.6–1.5 ms for Sol's 307. Sorting a slab took under 0.5 ms.

### Verdict against the 50 ms line, per location

| Location | query warm | query, cold feature cache | query + naming, warm, as one task | verdict for **one unsliced slab** |
|---|---|---|---|---|
| inner R≈1.5 | 26–32 ms ✓ | 66–71 ms ✗ | ~38–51 ms (borderline) | ✗ |
| bulge R≈0.3 | 4–5 ms ✓ | 40–41 ms ✓ | ~18–20 ms ✓ | ✓ |
| Sol | 29–33 ms ✓ | 55 ms ✗ | ~30–34 ms ✓ | ✗ when cold |
| XIGMAG | 23–29 ms ✓ | 30–32 ms ✓ | ~23–29 ms ✓ | ✓ |

The "query + naming" column leaves out multiplicity (~18–21 ms per dense slab in Chrome [I]) and the full-list re-sort on publish (§3, §7.3), so the dense-slab rows are optimistic.

**Verdict.** Option D removes the location dependence: every slab is ~8,700–10,000 density calls wherever it is, against 9,586–730,512 per query today. The warm query is under 50 ms at every location (≤ 33 ms). **A single slab done as one synchronous task does not stay under 50 ms** at the inner galaxy or at Sol on a cold feature cache (55–71 ms), and naming pushes a warm dense slab to the line. Every piece is sliceable, though: ~3 µs per cell, ~2 µs per name, and feature regions one at a time. **Decision 0 stands, conditional on the loader slicing within a slab.** Slicing means *all* of a slab's work — feature preparation, the cell scan, naming, multiplicity, the merge/re-sort/publish, and real-star suppression — under **one deadline shared by both nav instances**. Still to be measured in Phase 3: leaving PRISM, the six sort modes, cancelling a slab mid-way, and swapping in a slab with the same number of stars.

## 7. What the Phase 3 loader must budget [I, from the measurements above]

1. **Slice inside the slab, not per slab.** At ~3.0 µs per density call in Chrome on this PC, the 8 ms frame budget is about **2,500 cells**, so one slab takes ~4 frames of query work [I, estimate, not a limit]. The loop must be resumable mid-tier: the cursor is (tier, dx, dy, dz).
2. **Feature-region prefetch is its own budgeted step.** It costs up to ~42 ms when cold. It does **not** run once per column: each lookup reads 27 neighbouring 4 kpc regions (GalacticMap.js:176, :1594-1597), the region row changes at y = 0 (:1384), and above + below the plane together need 36 regions against a 32-entry cache (:177). When slab queries alternate across y = 0, every query rebuilds 9 of its 27 regions [M, node, `verify/lru-thrash.mjs`, at inner R=1.5 and Sol]; that adds ~0–6 ms per query in node (14.0–19.6 ms alternating vs 13.2–13.8 ms one-sided). So the loader needs a retention rule — a cache of ≥ 36 entries, or prefetching both layers — and must generate one region per slice or prefetch before the first slab, never inline in the first slab. "≤ 512 samples ≈ 1.5 ms" per region is an **estimate** [I]: region build calls `potentialDerivedDensity(R, y)` with no angle (GalacticMap.js:1449), which skips the spiral term, but nobody has timed it.
3. **Naming is a sliced step too.** At ~2 µs per star warm and up to ~8 µs the first time, dense slabs (5.5k–6.7k rows) need 2–6 frames. Multiplicity is its own line: it is cached by seed (`state.js:611`), so only new rows pay, but a new row costs 2.0–2.4 µs in node [M, `verify/mult-cost.mjs`] — ~11–13 ms per 5.5k-star slab in node, ~18–21 ms in Chrome [I, ×1.6], on top of naming. The merge is not cheap: `state.js:986-1010` copies and re-sorts every loaded row on each publish (NAME sort over 64k rows: 28 ms node, ~45 ms Chrome [I]); "< 1 ms" holds only for a distance sort of a single slab. The row projection (`designs.js:3038-3042`) and list mode (`:3137-3140`, loops over all rows) also run after each publish and are unmeasured.
3a. **Real-star replacement needs its own budget line.** `RealStarCatalog.js:140-147` scans the whole catalogue on every query and `NavComputer.js:3794-3799` scans all loaded rows for each real star. Plan §8's 3D-neighbourhood suppression is a different algorithm and is unpriced.
4. **One shared deadline for all instances.** The overlay and the cockpit can load at the same time (§5). Per-instance 8 ms slices would mean 16 ms per frame. The cockpit instance must also stop or suspend its loading when it is not rendered (today it keeps going in ORRERY).
5. **Use deadlines, not counts. Measured reason:** Chrome here is ~1.6× slower than node at the same math, so any headless budget understates browser cost by at least that factor. Slower machines are worse still.
6. **Whole column [I, estimates, not limits]:** 60 slabs × (~30 ms query + ≤ ~20 ms naming) ≈ 2–3 s of background work. At 8 ms per frame that is ~250–400 frames, or about 4–7 s at 60 fps, after the visible slab arrives in ~4–10 frames.
7. **Do not keep today's box sizing.** If any path keeps `_localCubeSize` as the width, fix the half/full mismatch (NavComputer.js:1593 vs :3698/:3750). Otherwise the sparse rim (R > 14) costs 4–11× Sol per unit of y.

## 8. Method notes

- Reaching XIGMAG used the nav's own commit contract: `overlay._onCommit({type:'warp', target:'star', star:{wx,wy,wz,seed,…}})` with the exact star found by `findStarsInPrism` at the recorded position (seed 694060861). The game arrived with `_currentSystemName` = XIGMAG-2AE101GKK2 and player = star position. Sol came from `window._lab.enterSol()`, and the game reports Sol at (8, 0.025, 0). The REGION level was set with `_levelIndex = 2; _applyLevelView()`, which does no loading. PRISM was always entered by synthetic Tab, the real key path.
- Instrumentation wrapped `HashGridStarfield.findStarsInPrism`, `NavComputer.prototype._queryYRange` and `_scheduleBgExpand` (its `setTimeout` callback was timed), and a `longtask` PerformanceObserver. Density counters on `GalacticMap.prototype` were installed only for the counting runs.
- The page was reloaded before the measurements and again before the cold option-D run. Max's game was near Sol beforehand (7.999, 0.018, −0.009). It was left in Sol.

## 9. Scripts (in `/tmp/claude-1000/-home-ax/e3bfb779-bd19-48ee-9c65-af3fc876407b/scratchpad/phase0/`)

| File | What |
|---|---|
| `instrument.js` | Live monkeypatch instrumentation (pasted into `evaluate_script`) |
| `headless-same-bounds.mjs` | Node replay of the exact browser bounds (`--count` for density calls, `--sol-first` for order) |
| `cube-vs-radius.mjs` | Today's box width, cells per step and node time by galactic radius |
| `mathbench.js` | Same pure-math loop for node vs Chrome |
| `optionD-bench.js` | In-browser option-D slab benchmark, with today's and the corrected query |
| `trace-selftime.py` | Self-time by function from the trace |
| `trace-xigmag-design1.json.gz` | Performance trace: XIGMAG, design 1, warm, 5 callbacks |
| `verify/lru-thrash.mjs`, `verify/mult-cost.mjs`, `verify/rebuild-cost.mjs` | Node probes written to check the Astra review (feature-cache thrash across y = 0, multiplicity per new row, full-list copy + re-sort) |

## 10. Second opinion (Astra)

Job dir: `.astra/jobs/20261002-120700-phase0-prism-stall-review/` (report in `report.md` and `rounds/01/result.json`; brief at `scratchpad/phase0/astra/brief.md`). One round, ~3 min, exit 0, status `complete`, no pending questions, no `src/` edits. **Astra's verdict:** option D holds, "yes with changes" — feasible, not yet shown end to end; its top Phase 3 item is to put everything a slab publish sets off (full row rebuild, sort, render pass) under one deadline shared by both nav instances.

Each point was checked against the code [R] or with a node probe [M] before it went into this report:

| # | Astra's point | Mark | How it was handled |
|---|---|---|---|
| 1 | Feature regions are not built once per column | CONFIRMED, but smaller than Astra's HIGH | §7.2 rewritten: 9 of 27 regions rebuilt per query when slabs alternate across y = 0 with the 32-entry cache; ~0–6 ms extra per query in node. A loader-design point (retention rule), not a change to the verdict. |
| 2 | Today's numbers time the query, not what runs after it | CONFIRMED, one detail **wrong** | Added to §3 and §7.3 (full-list copy + re-sort, multiplicity per new row). **Rejected detail:** Astra called multiplicity "uncached"; it is cached by seed (`state.js:611`), so only new rows pay. |
| 3 | Slicing needs more than a cell cursor | CONFIRMED | §6 verdict and §7.2: feature lookup runs before the tier loops (HashGridStarfield.js:645-649), one sort at the end (:740); the per-region "≈1.5 ms" is marked as an untimed estimate. |
| 4 | Real-star replacement needs its own budget | CONFIRMED | Added as §7.3a. |
| 5 | Node replay lacks the real feature catalogue | Code facts CONFIRMED; impact UNVERIFIED | §4 caveat added; the 1.5–1.65× factor is now called "observed", not a minimum. |
| 6 | The "corrected" query changes more than the 1.1× test | CONFIRMED | §6 now lists all its changes (padding 13,680 → 23,620 cells visited, skip limit 201, in-loop counting); the ~10% cost figure still holds because density calls rise only ~10%. |
| 7 | Half/full-width mismatch has more consumers | CONFIRMED | §3 now names the pan clamp (:1404), :3549 and :1999 as half-width readers that a fix must change together. |
| 8 | Density is per surviving cell; §7 frame/time figures are estimates | CONFIRMED | §3 and §7.1/§7.6 wording changed accordingly. |

Also fixed after the review: four `HashGridStarfield.js` line citations had drifted by 1–8 lines (:644 → :645, :675-677 → :679-681, :680 → :684, :681 → :689). The `GalacticMap.js` and `NavComputer.js` citations were re-checked and are correct.
