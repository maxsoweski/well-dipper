# Gate #3 — The Interpenetration Statistic (DESIGN)

**File:** docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-3-interpenetration-statistic-DESIGN.md
**Date:** 2026-07-03
**Status:** **PRE-CODE GATE RESOLVED — feeds the V2-2 contract**
**Discharges:** ROADMAP v2.1 §3.1 "Critical path" pre-code gate #3 (the third of THREE that block V2-2), = §5.4 #2's *"interpenetration statistic … named-but-undefined measurement today (zero metric infrastructure in the repo)"*, co-located with delegable #2.
**Validation script:** `gate-3-interpenetration-validation.mjs` (same dir; `node docs/WORKSTREAMS/world-engine-history-program-2026-06-27/gate-3-interpenetration-validation.mjs` from repo root — deterministic, three-free, ~2 s).

**Line of sight → north star:** V2-2's `writeLidResponseSphere` must produce *predicted-but-never-observed* compound worlds (a shield emerging from a corona at one center), not re-rolls of the catalog. The single failure that would silently defeat the whole pilot is emitting **two catalog landforms side by side** — an Io-patch *tiled* beside a Venus-patch — and calling it "mixed." This gate builds the automated instrument (§5.4 #2) that tells those two apart, so the falsification criterion is measurable and not a matter of eyeballing.

---

## Decision (pinned)

**The measured object.** V2-2 emits a per-node `primitiveId: Int32Array` (precedent `magmatism.js:220` `plumeId`). Project it to a **binary family field** `cls[i] = familyOf(primitiveId[i]) ∈ {PIERCE(1), TENT(0)}` — PIERCE = magmatic/weak-lid expressions (shield, caldera, patera, lava-plain), TENT = strong-lid expressions (corona, tessera, rift, stagnant plains). The statistic runs on `cls` over the sphere's node-adjacency graph (`carrier.adj`).

**The pinned statistic — `Π = C · F`**, with an explicit **companion guard M** and an AC boolean rule. All three defined on the pierce ("figure" = minority-class) connected components of `cls`:

- **F — fragmentation (anti-TILING).** `F = 1 − Σ_k (e_k / E)²` (Herfindahl over per-component *effective-compact areas* `e_k = a_k·q_k`, `E = Σ e_k`, `a_k = s_k·4π/N`). `F→0` for one/few segregated blobs (the Io-beside-Venus failure); `F→1−1/K` for K dispersed regions.
- **C — compactness (anti-SCATTER, geometric).** `C = (Σ_k a_k·q_k) / (Σ_k a_k)` = fraction of pierce area that is *compactly organized*, where per component `q_k = clamp01( B_disc(s_k) / B_k )`: `B_k` = its boundary-node count (figure nodes with ≥1 non-figure neighbour), `B_disc(s_k) = 2π·sin ρ_k / meanEdgeAngle` with `ρ_k = acos(1 − a_k/2π)` (the 1-ring boundary-node count of an **equal-area geodesic disc**). `q=1` for a round disc, `→0` for a fractal/percolated/speckled blob. Components below `SIZE_FLOOR = max(6, round(0.004·N))` (a random speck, not a legible feature) score `q=0`.
- **M — join-count mixing index (anti-SCATTER, companion guard).** The roadmap's named candidate: `M = clamp01( E_AB / E[E_AB] )`, `E_AB` = heterotypic edge count, `E[E_AB] = |E|·2·n_A·n_B / (N(N−1))` (label-permutation null). `M≈1` ⇔ spatially random (the salt-and-pepper mush); compound never exceeds ≈0.42.
- **Π range** `[0,1)`. `Π` is HIGH only when pierce is BOTH broken into many dispersed regions (`F`, beats tiling) AND those regions are compact discs (`C`, beats scatter).

**AC rule (what V2-2's contract pins):** a world **PASSES** the interpenetration criterion iff
> **`Π ≥ PI_STAR (0.15)`  AND  `M ≤ M_MAX (0.70)`**, on the corona-pierced compound world, **median over 8 seeds passing** with **min-over-seeds also passing**.

`Π = C·F` is the primary; the `M ≤ M_MAX` boolean is the **companion guard** the task requires (it closes the one residual leak — see Anti-mush below). AC-MIX-DISCRETE is the third, separate leg (below).

**Every named constant:** `PIERCE/TENT` = the `familyOf` projection (load-bearing, §Open-Q1). `SIZE_FLOOR = max(6, round(0.004·N))` nodes (≥0.4 % of the sphere = legible; resolution-invariant because real features scale with N, random specks do not). `PI_STAR = 0.15`. `M_MAX = 0.70`. `meanEdgeAngle`, `nodeArea = 4π/N` = read from the actual mesh (no magic length constant). Adjacency `k = 6` (Fibonacci fallback only — §Sphere sampling).

---

## Why not the roadmap's raw mixing index alone

The roadmap named "a cross-type nearest-neighbour mixing index over `primitiveId`" (= `M`). Run against synthetic fields, **`M` is necessary but insufficient**, for two independent reasons, so it cannot be the whole statistic:
1. **`M` scores random scatter as MAXIMALLY mixed** (`M≈1`) — that is exactly the mush `AC-MIX-DISCRETE` forbids. A "reward high M" rule would rank the worst mush the best.
2. **`M` is resolution-dependent for the tiling contrast** — heterotypic-edge fraction scales as `1/√N` for fixed geometry, so compound-`M` falls 0.38 → 0.075 from N=1500 → 40962. A fixed `M` threshold cannot separate tiling from compound across meshes.
`Π = C·F` fixes both (geometric, resolution-invariant). `M` is retained **only** as the companion scatter gate, where it is decisive at *every* resolution (random ⇒ `M≈1` regardless of N).

## The salt-and-pepper trap, addressed head-on (division of labor)

Random per-node scatter satisfies `AC-MIX-DISCRETE` (every node still has exactly one primitive) yet is pure mush. Three legs catch it, each a different mechanism:

| Guard | Catches | Mechanism |
|---|---|---|
| **AC-MIX-DISCRETE** (V2-2, already required) | **blur** — a node whose height blends two primitives | every node's height derives from exactly one `primitiveId`; makes the field well-defined so it is join-countable at all |
| **`C` (compactness)** | scatter, at fine meshes | scatter's components are fractal/speckled, not discs ⇒ `q→0` ⇒ `C→0`. Cleanly kills scatter for N≳10 k |
| **`M ≤ M_MAX` (companion)** | scatter, at coarse meshes | at N=1500 + intermediate fraction, small random clumps are "accidentally compact" and `C` leaks to ~0.5 (see f=0.30 row). Scatter is spatial randomness ⇒ `M≈1` there too ⇒ the gate rejects it |

Structured interpenetration (pierce discs nested in/adjacent to tent at shared centers) is the *only* configuration that is simultaneously fragmented (`F` high), compact (`C` high), and sub-random (`M` low). Tiling fails `F`; scatter fails `C` and/or `M`; blur fails AC-MIX-DISCRETE.

---

## Numeric calibration (computed — `node …/gate-3-interpenetration-validation.mjs`)

Synthetic `primitiveId` families on an inline Fibonacci sphere, mean over seeds `[1,2,3,7,42]`. `Π = C·F`; `M` reported. (a) TILED = hemisphere split + Voronoi-patch segregation; (b) COMPOUND = pierce discs dispersed & enclosed by tent; (b′) COMPOUND-MIXED = ½ dispersed discs + ½ one clustered cap; (c) SCATTER = seeded per-node random.

**N = 1500** (edges 4768, meanEdgeAngle 0.1039, sizeFloor 6) — calibration single round disc: `C=0.804 F=0.000 Π=0.000 M=0.119` (a lone blob → F=0, correct).

| world | f(act) | M | C | F | **Π** | nComp |
|---|---|---|---|---|---|---|
| TILED | 0.074 | 0.064 | 0.462 | 0.000 | **0.000** | 1 |
| COMPOUND | 0.095 | 0.382 | 0.875 | 0.878 | **0.770** | 10 |
| COMPOUND-MIXED | 0.096 | 0.314 | 0.862 | 0.734 | **0.634** | 9 |
| SCATTER | 0.098 | 0.999 | 0.000 | 0.000 | **0.000** | 109 |
| TILED | 0.304 | 0.083 | 0.729 | 0.000 | **0.000** | 1 |
| COMPOUND | 0.256 | 0.244 | 0.752 | 0.820 | **0.619** | 7 |
| COMPOUND-MIXED | 0.277 | 0.206 | 0.714 | 0.641 | **0.458** | 6 |
| SCATTER | 0.306 | **0.991** | 0.502 | 0.949 | **0.477** | 108 |

The bold `SCATTER f=0.30 Π=0.477` is the **C leak** — and precisely where the companion guard earns its place: its `M=0.991 ≫ 0.70` ⇒ **rejected**.

**N = 40962** (edges 123608, meanEdgeAngle 0.0193, sizeFloor 164) — calibration disc `C=0.881 F=0.000 Π=0.000`.

| world | f(act) | M | C | F | **Π** |
|---|---|---|---|---|---|
| TILED | 0.074 | 0.013 | 0.445 | 0.000 | **0.000** |
| COMPOUND | 0.096 | 0.075 | 0.817 | 0.891 | **0.730** |
| COMPOUND-MIXED | 0.097 | 0.058 | 0.916 | 0.677 | **0.621** |
| SCATTER | 0.099 | 1.000 | 0.000 | 0.000 | **0.000** |
| COMPOUND | 0.257 | 0.047 | 0.753 | 0.829 | **0.626** |
| SCATTER | 0.300 | 0.999 | 0.000 | 0.000 | **0.000** |

At the fine (lab/game-scale) mesh, `C` alone already kills scatter (Π=0.000); the M gate is belt-and-suspenders there and load-bearing only at N=1500.

**AC-rule sweep** (f∈{0.10,0.30}, both N, 5 seeds = 20 worlds/class; PASS iff Π≥0.15 AND M≤0.70):

| world | Π [min · mean · max] | M [min · mean · max] | PASS | want |
|---|---|---|---|---|
| TILED | 0.000 · 0.000 · 0.000 | 0.000 · 0.044 · 0.115 | **0 %** | FAIL ✓ |
| COMPOUND | 0.518 · 0.686 · 0.880 | 0.042 · 0.187 · 0.417 | **100 %** | PASS ✓ |
| COMPOUND-MIXED | 0.397 · 0.553 · 0.690 | 0.035 · 0.154 · 0.327 | **100 %** | PASS ✓ |
| SCATTER | 0.000 · 0.119 · 0.531 | **0.986 · 0.997 · 1.000** | **0 %** | FAIL ✓ |

**Margins:** worst PASS-world (compound-mixed) `Π = 0.397`, i.e. **+0.247 (≈2.6×) above `PI_STAR`**; worst scatter `M = 0.986`, **+0.286 above `M_MAX`**; `scatter worlds passing BOTH gates = 0`. **Sensitivity — f=0.50 extreme:** compound `Π(min)` falls to **0.147–0.158 ≈ `PI_STAR`** (discs merge; pierce is no longer a minority "figure"). Margin survives f∈{0.10,0.30}; it *compresses at f=0.50* — so the AC's compound test world must keep pierce a **minority** (shields ARE the minority against a corona/plains ground), which the pilot's physics already implies.

---

## Per-decision confidence

| Decision | Conf | What would change it |
|---|---|---|
| `Π = C·F` separates tiling & scatter from compound at f≤~0.35 | **HIGH** | validated 100 %/0 % over 80 synthetic worlds × 2 meshes; would drop if the real `primitiveId` field is not quasi-disc-like (e.g. long ribbon shields) |
| `M ≤ M_MAX` closes the coarse-mesh `C` leak | **HIGH** | scatter `M≥0.986` at every N/f tested; would drop only if a *non-random* field could reach M>0.70 — none of tiling/compound approach it (max 0.417) |
| `PI_STAR = 0.15`, `M_MAX = 0.70` | **MEDIUM** | thresholds chosen with ~2.6× / 0.29 margins on *synthetic* worlds; **must be re-confirmed on the REAL V2-2 output** (§Open-Q) before freezing — the real field's disc regularity and pierce fraction set the true compound Π |
| Fibonacci+kNN is an adequate stand-in for `carrier.adj` | **MEDIUM-HIGH** | it is a graph statistic; quasi-uniform adjacency is all it needs. Re-run on the real irregular mesh at V2-2 to confirm meanEdgeAngle/area assumptions (§Open-Q4) |
| PIERCE/TENT `familyOf` projection is the right axis | **MEDIUM** | own modeling judgment (below); if lava-plain vs basaltic-plain are not distinct primitiveIds the projection collapses (§Open-Q2) |
| Type-only Π ⇒ "shared-center nesting" | **LOW-MEDIUM** | type-only cannot prove the pierce disc and its tent ring share ONE upwelling center; a `centerId` field would (§Open-Q3). Π proves *not-tiled & not-scatter*; center-sharing is the confirmatory layer |

**Attribution.** The pierce-vs-tent physical dichotomy (heat-pipe/weak-lid *pierces*; strong-lid *tents* into coronae/tessera) is grounded in `condition-to-regime-research.md` §1–§4 (Moresi & Solomatov yield-stress control; Moore & Webb heat-pipe). The **statistic itself** — join-count mixing, isoperimetric compactness, Herfindahl fragmentation — is **my own spatial-statistics modeling judgment** (standard categorical spatial-autocorrelation methodology); no external citation is asserted for it.

---

## Determinism + cost

Test-time metric, bounded, no convergence loop. On the real world, computing `{Π, M}` is **three O(N·deg) passes** over `primitiveId + adj` (join count; union-find components; per-component boundary/area) — the same order as one relax pass the writers already run. No `alea` in the statistic (pure over the field); the validation script's synthetic generators use seeded `alea` only, fixed draw order, no `Math.random`/`Date.now`. Two full runs are **byte-identical** except wall-clock timing prints. Runtime ~2 s incl. the N=40962 mesh build.

---

## Open questions for the V2-2 contract (incl. plumbing gaps)

1. **`familyOf(primitiveId)` projection must be authored + exported (PLUMBING GAP).** The statistic is defined on the PIERCE/TENT binary, but `primitiveId` is the multi-valued expression type. V2-2 must pin the `primitiveId` enum AND a `familyOf` map. Load-bearing: mis-assigning even one primitive (e.g. patera→TENT) shifts the axis. *Recommend the enum and `familyOf` live beside `writeLidResponseSphere` and are imported by both the writer and the metric.*
2. **Lava-plain vs stagnant basaltic-plain must be DISTINCT `primitiveId` values (PLUMBING GAP).** They are the two ambiguous "plains"; if V2-2 lumps both into one "plains" id, `familyOf` cannot route lava-plain→PIERCE and basaltic-plain→TENT and the Io-vs-Venus contrast is blurred at the exact seam the test guards.
3. **Co-emit a per-node `centerId: Int32Array` (RECOMMENDED PLUMBING).** Type-only `Π` proves *not-tiled & not-scatter*; it cannot by itself prove a shield disc and its surrounding corona share ONE upwelling center (§5.4 #2's literal "a shield emerging FROM a corona at ONE center"). With `centerId` (which the mixed-interior already computes as `nearestPlume`/`plumeId`) a **confirmatory statistic** is one pass: *compound-center fraction* = fraction of centers whose node set contains BOTH a PIERCE and a TENT primitive. Recommend V2-2 emit it and the contract add a secondary AC (e.g. ≥2 compound centers present).
4. **Three-free mesh / `carrier.adj` for the headless AC (PLUMBING GAP).** The AC must run headless, but `buildIrregularSphere` (the real mesh) lives in `planet-lod-rivers.js`, which imports `three`; `sphereField.makeSphereField` only *consumes* a prebuilt `{verts,faces,adj}`. This gate used an **inline Fibonacci+kNN** sphere (three-free) to validate the statistic's discriminating power. V2-2 must decide the AC's mesh source: either (a) extract a three-free irregular-mesh builder, or (b) run the AC on the same Fibonacci fallback, or (c) accept `three` in the test. The statistic reads only `verts`, `adj`, `meanEdgeAngle`, `nodeArea=4π/N`.
5. **Node-area / edge-length uniformity assumption.** `C`'s `B_disc` and `nodeArea` assume a **quasi-uniform** mesh (Fibonacci and the Lloyd-relaxed irregular sphere both qualify). If the real mesh has strongly non-uniform node areas, weight areas by true per-node solid angle and use per-edge arc length. Flag for re-validation at V2-2 (Open-Q4 re-run answers it).
6. **Freeze `PI_STAR`/`M_MAX` only after a real-world dry run.** The thresholds are validated on synthetic worlds; the first V2-2 build should print `{Π, M, C, F}` on the actual corona-pierced world across the 8 protocol seeds, confirm the compound world clears `PI_STAR` with margin and its scatter-shuffled / tiled-reassigned rebuilds fall below, THEN freeze. The measurement protocol (8 seeds, median-passes-with-min-passes, on the §5.4 #2 corona-pierced compound world at its native minority pierce fraction) is pinned above; the two numeric constants are provisional-pending-that-dry-run.
7. **Interaction with delegable #2 (`localYield`).** `localYield(L,i)` sets which centers pierce; if it is calibrated so *almost all* or *almost no* centers pierce, the pierce fraction leaves the validated f∈[0.10,0.35] band and Π margins move (f→0.5 compresses). The two gates should be co-calibrated so the compound world sits at a minority pierce fraction.
