# AC-CENSUS — does radius reach every system?

> ## ⚠ CORRECTION (2026-07-25, adversarial review) — the MEASURED row's error bar was understated
>
> The substrate/relief row cites **R^0.458 ± 0.015**. The point estimate stands, but the interval was
> quoted at z = 2 on a three-radius fit (**dof = 1**), where the correct 95% multiplier is t = 12.71.
> The honest interval is roughly **±0.19**, which contains 0.5. So:
>
> - The substrate/relief row remains **WIRED** — the response is unambiguous and the `radiusEarth`
>   control fits exactly 1.000.
> - Any reading of "0.458 is measurably different from √R" is **withdrawn**. It is not.
> - Tightening it needs more driver values (dof scales as N − 2), not more seeds.
>
> Every other row is LAW-AUDITED or SOURCE-TRACED and is unaffected — in particular the atmosphere
> frozen-feed finding is a source fact, not a statistical one. Details: `AC-CURVE-live.md` correction
> block; fixes pinned by `tests/instrument-review-fixes.test.js`.


**Date:** 2026-07-25 · Lane A · the instrument's first real output
**Answers:** Max, verbatim — *"We need to get the radius adjustment working with all other systems.
Tectonics, craters, everything need to adjust to the new radius when adjusted. **I can tell that's
not happening across the board.**"*

**He is right, and the reason is now located to specific lines.** The headline is not that systems
lack radius laws — several have correct ones. It is that **a group of consumers reads radius from a
frozen preset constant rather than from the live slider.**

## Evidence classes used

Each row states how it was established, because they are not equally strong:

- **MEASURED** — field-layer response curve, M seeds, mean ± SEM, fitted exponent (strongest).
- **LAW-AUDITED** — exponent asserted against the pure function that states it (exact, but a drift
  guard; it does not prove the law reaches the render).
- **SOURCE-TRACED** — read from source this session, not yet measured (weakest; flagged as such).

---

## The census

| System | Radius reaches it? | Evidence | Detail |
|---|---|---|---|
| **Substrate / relief** | ✅ **WIRED** | MEASURED | Physical form size ∝ R^**0.458 ± 0.015** (r² 0.999, M=5, R=4/8/16). On-screen size held ≈ constant (−0.042 ± 0.015) by the display keying. |
| **Bombardment / craters** | ✅ **WIRED** (strongest) | LAW-AUDITED | count ∝ R² · mesh floor ∝ R¹ · basin cap ∝ R¹ · size ∝ g^−0.17 · count g-independent. All 6 laws PASS exactly; 6 planted defects each caught by name. |
| **Rivers** | ✅ **WIRED** (unmeasured) | SOURCE-TRACED | `widthRadiusFactor(radiusEarth)` + `paramsForRadius(params, radiusEarth, …)` in `planet-lod-rivers.js`. Law present; **not yet field-measured or law-audited.** |
| **Tectonics / plates** | ⚠️ **PARTIAL** | SOURCE-TRACED | `plates.js` carries 2 direct radius references; `tectonic.js` responds only via `surfaceGravity` (indirect, through the v2-6 coherence g = g_c·(R/R_c)). `stressFabric.js`, `province.js`, `passiveMargins.js`, `substrate.js`, `sphereField.js`: **no radius and no gravity reference at all.** |
| **Volcanism / magmatism** | ⚠️ **PARTIAL — scale only, not population** | SOURCE-TRACED | No direct radius. Edifice HEIGHT responds to gravity: `gFactor = clamp(0.4, 2.5, (g/g₀)^−0.5)` (`magmatism.js:120`), so radius reaches it indirectly and **clamped**. Plume COUNT, spacing and strength key on thermal deviation only (`K_COUNT · Hd`) — **the volcanic population does not answer radius at all.** |
| **Atmosphere / bands** | ❌ **LAW CORRECT, FEED BROKEN** | SOURCE-TRACED | See below. This is a **defect**, not a missing feature. |

---

## The atmosphere finding (the sharp one)

The Rhines band law is present and physically right:

```
LAW 1  Rhines band count   N = RHINES_K · √(a·Ω / U)      climate-e5.js:23, :119-120
```

β = 2Ω/a, so band count scales as **√a** — which is exactly what Rhines scaling requires, and it
matches the independent derivation (L_β = √(U/β), N = πa/L_β ∝ √a). Nothing wrong with the physics.

**But `a` is fed from a frozen constant:**

```js
const _fp = DRIVER_PRESETS[driverUI.preset];          // planet-lod-lab.html:2843 — a FROZEN preset object
…
radius: (_fp.radiusEarth ?? 1) / 11.2,                // :2856, :2935 — Jupiter 11.2 → 1.0
```

`_fp` is read straight out of `DRIVER_PRESETS` and is **never mutated by the radius slider**, which
writes `state.planetRadiusEarth`. The two are known to differ — the very next line passes
`state.planetRadiusEarth` explicitly into `deriveConditionVector` (`:2851`). So the atmosphere's
radius input is pinned at preset time and the slider never reaches it.

**Four more consumers share the same frozen feed:**

| Line | Consumer | Consequence of the frozen feed |
|---|---|---|
| `:3278` | `state.bandCount = round(12 · _fp.radiusEarth / _rotH)` | band count fixed at preset radius |
| `:3370` | cloud-regime selection (`_fp.radiusEarth < 6`) | regime cannot change with the slider |
| `:3521` | giant-dynamo gate (`_fp.radiusEarth >= 3.5`) | dynamo state fixed at preset radius |
| `:5146` | crater relevance at preset time | boot-enable set fixed at preset radius |

By contrast the live paths use `state.planetRadiusEarth` (`:2851`) or
`_bodyDrivers.condition.radiusEarth` (`:3703`). **The fix is a feed change, not new physics** — but
whether each of these five *should* track the slider is a design call, not a measurement one:
`:5146` (crater relevance at preset time) may well be correct as-is.

---

## Answering Max's sentence directly

> "Tectonics, craters, everything need to adjust to the new radius."

- **Craters already do**, thoroughly — six laws, all exact, all guarded.
- **Substrate/relief does**, measured.
- **Rivers appear to**, unverified.
- **Tectonics does so only partially**, and several of its modules have no radius or gravity input at all.
- **Volcanism responds in edifice height only** (indirectly, via clamped gravity) — its population does not.
- **Atmosphere has the right law and the wrong wire.**

So "not happening across the board" is accurate, and it decomposes into three different problems that
need three different fixes: a **broken feed** (atmosphere + 4 co-consumers), **missing couplings**
(volcanism population, several tectonics modules), and **unverified claims** (rivers).

## What this census does NOT yet establish

Stated so the table is not over-read:

1. **Only two rows are MEASURED.** Tectonics, volcanism, rivers and atmosphere are source-traced.
   Turning them into measured rows needs per-system field observables (a plate-boundary mask, an
   edifice detector, a channel mask, a band profile) wired into `describeSample` — a real slice of
   work, not a switch.
2. **No vertical-magnitude row exists anywhere**, because the height axis has no km calibration
   (the named follow-on workstream).
3. **Whether these systems *should* respond to radius, and in which frame** (physical km vs on-screen)
   is Max's design call. The instrument reports both frames and takes no position.
