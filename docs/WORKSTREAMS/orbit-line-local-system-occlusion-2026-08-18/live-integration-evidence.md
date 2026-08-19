# Live integration evidence — orbit-line local-system occlusion

**Build:** working tree at `e0b6fa8` + the occlusion change · **Date:** 2026-08-19
**Seed:** `wd-10` · **Page RELOADED with cache ignored before every measurement below.**

> ⛔ **Why the reload line is first.** This lane lost three commits and a 13-agent workflow to
> HMR-duplicated module state that faked a constant `0.779424×` orbit-radius error, survived four
> respawns and `freezeFrame`, and vanished on one reload. Every number here was taken after a hard
> reload of a page that had `src` edits fired into it. See the b5 handoff §11.

---

## What the SHADER is actually reading — the packed texture, live

Read straight out of `uData.image.data` on the running page, not from the CPU-side objects:

| | measured | expected |
|---|---|---|
| texture dimensions | **64 × 18** | `CONIC_MAX` × (`10 + KEEPOUT_MAX`) |
| ring descriptors | **16** | unchanged from the barycentre workstream's 16 |
| rings carrying a disc | **4** | the four moon-bearing planets' heliocentric rings |

| ring | radius | `nk` | verdict |
|---|---:|---:|---|
| 0, 1 | 109.48, 116.19 | **0** | binary-STAR orbit rings — ✓ AC-NO-COLLATERAL-OCCLUSION |
| 2 | 564.16 | **0** | planet 0's heliocentric ring; planet 0 has no moons — ✓ AC-APPLIES-GENERALLY |
| 3 | 1073.89 | **1** | `reff2 = 0.122287` |
| 4 | 1830.00 | **1** | `reff2 = 3.66248` |
| **5** | **3388.11** | **1** | **the pair's own heliocentric ring**, `reff2 = 0.806166` = `0.897868²` ✓ |
| 6 | 7431.39 | **1** | `reff2 = 90.453102` = `9.5107²` — planet 4, **undominated, 3 moons** ✓ |
| 7–15 | ≤ 9.51 | **0** | every moon ring, **including the pair's r1 and r2** — ✓ AC-LOCAL-RINGS-SURVIVE |

⭐ Ring 6 is the load-bearing row for **AC-APPLIES-GENERALLY**: planet 4 earned no barycentric
rings (it is undominated, 3 moons) and still gets a keep-out, at exactly its outermost local ring
radius. No special case for the 27 pairs.

## AC-GAP — one contiguous cut, measured on the circle

Walked planet 3's heliocentric circle at 400 000 samples in world space:

| | measured | predicted |
|---|---|---|
| masked runs on the circle | **1** | 1 — the predicate has no camera term, so this holds at every pose |
| gap angular width | `5.18363e-4` rad | `2·asin(R/r) = 5.30011e-4` |
| gap arc length | **1.75627** scene units | chord `2R = 1.795735` |

The ~2 % shortfall in both rows is the 400 k sampling step (`1.57e-5` rad) against a gap `5.3e-4`
wide — under one step. It is measurement resolution, not a geometric error; the headless suite
bisects instead of sampling and lands the endpoints on `|P − C| = R` to 12 decimal places against
`sqrt(reff2)` and 7 against `R` (the residual there is the float32 texel).

## AC-LOCAL-RINGS-SURVIVE — the trap, live

| | measured |
|---|---|
| the pair's local ring radii | **0.254132** and **0.897868** — unchanged |
| in primary radii | **5.5332** and **19.5492** — identical to the barycentre workstream |
| discs applied to either | **0** |
| disc radius for planet 3 | **0.897868** — exactly the outermost local ring |

The inner ring lies entirely inside the outer one and is fully drawn.

## AC-HIT-TESTING-UNCHANGED / AC-NO-COLLATERAL-OCCLUSION

| | measured |
|---|---|
| ring proxies in scene | **16** — the same 16 as before the change |
| visible | **16 / 16** |
| with an intact baked hit perimeter | **16 / 16** |
| console errors or warnings since load | **none** |

## Headless + gate

- `src/objects/__tests__/OrbitConicField.occlusion.test.js` — **21/21 pass**.
- Whole ring/conic battery — **131/131 pass**, unchanged.
- ⭐ **Full-repo failure set is BYTE-IDENTICAL to the parent commit**: 32 failures at parent, 32 at
  HEAD, the same tests after stripping timings. Proven by stashing only the two changed `src` files
  and re-running. Those 32 are the moon window's red-by-design instruments plus the star-catalogue
  regeneration tests — none is a renderer test and none is caused by this change.
- `npm run check:conic-gl` — **22/22 mutants killed.** Includes M12, M15, M16 and M20, whose
  literals the disc-mask insert sits between. ⛔ Must be run with the agent sandbox disabled;
  Chrome cannot `socket()` inside it and the gate FATALs on launch, not on a real failure.

## AC-RING-BUDGET-AND-PERF — the frame-time number, measured

Protocol exactly as the AC specifies: same seed (`wd-10`), same body (planet 3), same framing
(`frameBody radii 34`), same window (1680 × 1020), `freezeFrame` so the scene is static, 120
warm-up frames discarded, then **N = 600** rAF deltas per arm. **The page was reloaded with cache
ignored between arms**, and the parent arm's renderer was confirmed on the page rather than assumed
— its packed texture reports **10 rows**, the build's **18**.

| arm | rows | n | median | p95 | min |
|---|---:|---:|---:|---:|---:|
| **parent** `e0b6fa8` | 10 | 600 | **4.2 ms** | **4.5 ms** | 3.5 ms |
| **build** `4cf67c5` | 18 | 600 | **4.2 ms** | **4.5 ms** | 3.6 ms |

**Median delta 0.0 ms, p95 delta 0.0 ms.** ⛔ State that as *below this measurement's resolution*,
not as zero: the deltas quantise at ~0.1 ms here and both arms sit on the same two values, so
anything under ~0.1 ms is invisible to it. What the number does establish is that there is no
regression of the size a per-pixel loop could plausibly have introduced.

The mechanism agrees: at this pose 4 of 16 rings carry a disc and every one has `nk = 1`, so twelve
of the sixteen rings pay one integer compare per `arcRoot` call and the other four pay one compare
plus one `texelFetch` — and only on pixels that already passed the band, extent and front-branch
gates.

⚠ Not a claim about the worst case. A pose with more moon-bearing planets in frame, or a system
approaching `KEEPOUT_MAX = 8` discs, is unmeasured.

## ⛔ NOT measured, and why

1. **A live click inside the occluded span.** The unit fence proves the disc path touches neither
   `mesh.visible` nor `orbitHitPositions`, and both are intact live, but the click itself is unrun.
2. **AC-UAT.** Max's alone. `deferred-to-max`, never passed by an agent.
