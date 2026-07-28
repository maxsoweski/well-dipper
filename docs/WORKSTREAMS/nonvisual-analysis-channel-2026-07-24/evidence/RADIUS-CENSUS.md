# AC-CENSUS — does radius reach every system?

> ⚠ **SUPERSEDED IN PART (gravity-selfcompression-2026-07-28).** Passages below describing `g = g_c·(R/R_c)` record the CONSTANT-DENSITY law that was live when this document was written. Gravity is now `g = g_c·f(R)/f(R_c)` with `f` piecewise in absolute Earth radii (`R^(4/3)` below 1 R⊕, `R^1.70` above), applied to the **rocky class only**; gas, icy and carbon presets are unchanged. Byte-exactness at canonical is unchanged. Kept as written for audit trail — do not read it as current behaviour.


> ## ✅ UPDATE (2026-07-25) — R1 `world-engine-radius-live-feed-2026-07-25` has landed
>
> The **broken feed** — one of this census's three findings — is fixed and measured. Rows updated
> below; the other two findings (missing couplings, and now a third) are untouched and remain R2.
>
> - **Atmosphere: ❌ FEED BROKEN → ✅ WIRED (measured live).** The Rhines law is now fed the drawn
>   radius. Live on Jovian at fixed seed, band count moves **5 → 14** across R = 3 → 16 (r² 0.991)
>   where it was previously constant. The **law itself** audits at exponent **0.500000** unrounded
>   (0.49647 ± 0.00925 as shipped, dof 38 — contains 0.5).
>   ⚠ **Do not confuse the two quantities.** `rhinesWavenumber()` is the law (∝√a); `bandCount` is a
>   *diagnostic* (zero-crossings of the realized `u` profile, which also carries the equatorial jet
>   and Ward polar structure) and scales as R^0.632 ± 0.018. Measuring the diagnostic and comparing
>   it to the law nearly produced a false "law failed" verdict during this build.
> - **Rivers: SOURCE-TRACED → ✅ WIRED for width, ❌ RADIUS-BLIND for population.** Width law measured
>   live in the render path at exponent **−1.00003 ± 0.00058** (r² 0.999997), `k·R` constant to 3e-3,
>   both clamps confirmed (2.5 ceiling / 0.08 floor). **FRAME: on-screen constancy**, the opposite
>   frame from craters' physical `count ∝ R²` — defensible under the ratified display model, now
>   named rather than assumed. **But `channelCount` is identical (5215) across a 9.6× radius range**,
>   then steps as `maxStrahler` drops 6→5→4 — an LOD signature, not a radius law. A bigger world gets
>   the *same* drainage network at coarser depth. **Same class of gap as volcanism.** → R2.
> - **Crater boot-enable site: settled by measurement, not opinion.** The `:5146` "R-stable within a
>   preset" claim HOLDS — 18 presets × 401 log-spaced radii, zero flips; the predicate's own clamps
>   bound any possible flip at 0.133 R⊕, 2.03× below the true reachable floor of 0.27 R⊕.
> - **A NEW defect class the census did not have a category for: composition CLASSIFIERS.** The
>   giant-dynamo gate looked like a frozen-feed site and is not one. `PRESET_ARCHETYPE` deliberately
>   maps Neptunian and Sub-Neptune to the same `'sub-neptune'` key, and `drawPresetRadius` keys its
>   PRNG on `'draw:radius:'+seed` with **no preset name** — so the two draw **bit-identical** radii at
>   every seed (2001/2001). A size-keyed discriminator therefore cannot separate them at all, which is
>   the gate's entire purpose. Rewiring it to the drawn radius *extinguished* the ice giant's aurora
>   on 67.5% of seeds. **Rule adopted: a CLASSIFIER reads canonical; a PHYSICS INPUT reads drawn.**
> - **`uBandCount` is NOT retired**, contrary to `docs/NOW.md`. It still drives the F25 jet/shear/
>   festoon geometry behind `uJetStrength > 0`. Only the band-VALUE consumer was retired.


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
| **Rivers** | ⚠️ **WIDTH WIRED (measured 2026-07-25), POPULATION RADIUS-BLIND** | MEASURED | WIDTH: law-audited AND field-measured live at exponent **−1.00003 ± 0.00058** (r² 0.999997, 10 values in the unclamped band; clamps 2.5/0.08 confirmed live). FRAME = **on-screen constancy** (`k = 1/R`), the OPPOSITE frame from craters' physical `count ∝ R²`. POPULATION: `channelCount` identical (5215) across a 9.6× radius range, then stepping as `maxStrahler` drops 6→5→4 — an LOD signature, not a radius law (fit r² 0.58). **A bigger world gets the same drainage network at coarser depth.** → R2. Evidence: `world-engine-radius-live-feed-2026-07-25/evidence/LIVE-ACS.md`. |
| **Tectonics / plates** | ⚠️ **PARTIAL** | SOURCE-TRACED | `plates.js` carries 2 direct radius references; `tectonic.js` responds only via `surfaceGravity` (indirect, through the v2-6 coherence g = g_c·(R/R_c)). `stressFabric.js`, `province.js`, `passiveMargins.js`, `substrate.js`, `sphereField.js`: **no radius and no gravity reference at all.** |
| **Volcanism / magmatism** | ⚠️ **PARTIAL — scale only, not population** | SOURCE-TRACED | No direct radius. Edifice HEIGHT responds to gravity: `gFactor = clamp(0.4, 2.5, (g/g₀)^−0.5)` (`magmatism.js:120`), so radius reaches it indirectly and **clamped**. Plume COUNT, spacing and strength key on thermal deviation only (`K_COUNT · Hd`) — **the volcanic population does not answer radius at all.** |
| **Atmosphere / bands** | ✅ **WIRED — feed fixed 2026-07-25** (was: law correct, feed broken) | MEASURED | The section below diagnosed it: right law, frozen feed. FIXED in R1 — the Rhines law now reads the drawn radius via the condition vector. Live: band count **5 → 14** across R = 3 → 16 at fixed seed (r² 0.991), previously constant. Law audits at exponent **0.500000** unrounded. ⚠ `bandCount` (a zero-crossing diagnostic) ≠ `rhinesWavenumber` (the law) — see the update block at the top. |

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
