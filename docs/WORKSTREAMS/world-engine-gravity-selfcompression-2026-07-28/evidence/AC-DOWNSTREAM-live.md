# AC-DOWNSTREAM — the live integration leg (2026-07-28)

Driven by working-Claude against the running lab on `:5175`, in an **isolated browser context**, one
page, **closed after**. Max's own tab (page 2) was never touched. This is *integration* testing —
objective assertions on the wired system — **not UAT**, which stays Max's alone.

Commit under test: `7d29e22`.

---

## 1. The corrected numbers reproduce in the live module graph

The verify workflow independently reproduced these headlessly; this run reproduces them again inside
the browser's own module loader (different loader, different JIT), on `Moon/Mercury (impact-airless)`,
R_c = 0.38, g_c = 0.277008, at R = 1.6:

| quantity | retired law | **shipped** | withdrawn pure-power |
|---|---|---|---|
| `condition.surfaceGravity` | 1.16635 | **2.23761** | 3.19054 |
| `craterSchedule.nStamp` | 90 | **72** | 64 |
| `craterSchedule.sizeMul` | 0.865892 | **0.775107** (−10.5%) | 0.729740 (−15.7%) |
| `regolithRoughness` | 2.2122e-1 | **1.8030e-1** (−18.5%) | 1.6127e-1 (−27.1%) |
| `transitionDiameterKm = 3.1/g` | 2.65786 | **1.38540** | 0.97162 |
| `reliefBudget.f_I` → `compositeMargins` | 0.365218 | **0.276828** (−24.2%) | 0.233428 (−36.1%) |

The right-hand column is what the contract originally claimed. It does **not** reproduce, confirming
the correction was the right call and not a rationalisation.

## 2. ⭐ The decisive check — the app's OWN condition vector, over its OWN draw path

The reconstruction above is still *me* computing. This is not: `rerollRadius()` drives the lab's real
draw + `applyDrivers` path, and the gravity is read straight off the condition vector **the lab built
for itself**, via `plateProbe().bodyDrivers.condition`. Expectations use **literal exponents**, never
production's `gravityRadiusShape` (see `tests/worldengine-v2-6-gcohere.test.js` for why).

```
n = 12 draws, 12 DISTINCT off-canonical radii
matches the SHIPPED piecewise law : 12/12
matches the RETIRED constant-density law : 0/12
```

Sample rows (R, g the app built, shipped-law expectation, retired-law expectation):

```
0.288158   0.19155327   0.19155327   0.21005856
0.369024   0.26639194   0.26639194   0.26900726
0.358106   0.25593559   0.25593559   0.26104850
0.312939   0.21382623   0.21382623   0.22812292
0.309217   0.21044243   0.21044243   0.22541000
0.283020   0.18701220   0.18701220   0.20631256
```

The law reaches the running engine, exactly, and is cleanly separable from the law it replaced.

## 3. ⭐ The disclosed carve-out, confirmed LIVE rather than argued from source

`state.surfaceGravity` — the sole feed of the global relief-amplitude uniform `uPerturb` — held at
**exactly `0.2770083102493075`** across every radius exercised in this session: the boot draw
(0.27296), three directly-set values (0.38 / 1.6 / 2.5), and all 12 `rerollRadius()` draws. It never
moved once.

That is `evidence/FINDING-uperturb-radius-blind.md` demonstrated in the running app, not inferred by
reading code. It is the reason AC-UAT tells Max up front that global relief amplitude will not
respond — so he is not sent hunting for something that cannot happen.

## 4. Inert consumers — re-checked, not assumed

- **E5 giant path** — `giant-drivers.js:234` back-solves `surfaceGravity = drawnMass / (R*R)` from a
  pinned mass, so the incoming value is discarded. Inert. (This also corrects an earlier draft of the
  DOES/UNLOCKS card, which wrongly listed giant-drivers as inheriting the new mass law.)
- **`tectonic.js:137/:207`** — reads `DEFAULT_GRAIN_DRIVERS`, which carries no gravity key, so
  `reliefGravityFactor(1) === 1.0` exactly. Dormant.
- **Gravity-slider override** (`planet-lod-lab.html:2812`) — ⚠ **SOURCE-VERIFIED ONLY, not driven
  live.** `driverOv` / `useOv` are module-scoped and not reachable from the page global, so I could
  not exercise it from an evaluate call. By source, `if (useOv('gravity')) _cond.surfaceGravity =
  driverOv.gravity;` assigns *after* `deriveConditionVector` returns, so an active override overwrites
  whatever the law produced — the law is bypassed by construction, independent of the exponent.
  Stated as a source read, not upgraded to a live result.

## 5. A correction to this document's own first attempt

My first live pass set `L.state.planetRadiusEarth` directly and read `plateProbe`, and got
`matchesShippedLaw: false` at every radius. **That was my harness, not the code**: poking the state
field does not trigger a re-derive, so the probe returned a bundle cached from the previous real
`applyDrivers`, still carrying the boot radius 0.27296. At the radius the vector *actually* carried,
`g` was 0.17820596 — matching the shipped law to 8 decimal places and not matching the retired law
(0.19898). Replaced with `rerollRadius()`, which drives the app's real path.

Worth recording because it is the third variant of one mistake in this workstream: a measurement that
returned a plausible-looking number while measuring the wrong thing. Here it produced a *false
negative* rather than a false positive, which is the only reason it was obvious.

**Also on record**: `_lab.responseCurve` exists and is the purpose-built radius sweep
(`feedback_use-the-built-instrument-not-a-hand-rolled-one`). It ran clean, but it draws **seeded**
radii rather than setting exact values (requested 0.4 → measured mean 0.336, sd 0.090 over 2 seeds),
so it answers "how does the field respond across the radius population" rather than "is the law exact
at radius X". For this AC the per-draw vector read is the right instrument; `responseCurve` is the
right one for the field-response questions in R2.

---

**Verdict for AC-DOWNSTREAM: the objective observable is met.** The predicted quantities move by the
corrected amounts, the law reaches the running engine on 12/12 real draws, and every consumer marked
inert is inert. One sub-item (the override path) is source-verified rather than live-driven and is
labelled as such.
