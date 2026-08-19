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

## ⛔ NOT measured, and why

1. **A frame-time number for AC-RING-BUDGET-AND-PERF.** Nothing in this repo can produce one
   headlessly — `tools/conic-gl-gate.mjs` has no clock and `tools/barycentre-probe.mjs` has no
   timing. It needs a live parent-vs-build comparison at a frozen pose with the page reloaded
   between arms, N ≥ 300 frames. **The AC is not satisfied until that runs.**
2. **A live click inside the occluded span.** The unit fence proves the disc path touches neither
   `mesh.visible` nor `orbitHitPositions`, and both are intact live, but the click itself is unrun.
3. **AC-UAT.** Max's alone. `deferred-to-max`, never passed by an agent.
