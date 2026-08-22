# AC5 — the solidFeatures import-back, and the seam nobody had named

**Measured:** 2026-08-22 · **Instrument:** `tools/solid-features-seam-probe.mjs` (reproducible by command)
**Status:** ✅ **LANDED 2026-08-22.** Max ruled **ADOPT**; the lab imports pack #2 and calls it. UAT CLOSED by Max the same day — see §6.

---

## 1. Why this pack was chosen

`AC2-pack-law-survey.md` scored it **0 claimed conflicts, 0 confirmed — "14 clean uniforms, nothing
to decide."** It is the only one of the seven with no law dispute in it, so it isolates the
*mechanism* of an import-back from the *rulings* the other six still carry.

## 2. The mechanism, read off the one precedent that worked

`giantDeck` is the only pack the lab imports back (`planet-lod-lab.html:188`), and it is a TWO-PART
split, not a single call:

| part | what it does |
|---|---|
| `Object.assign(state, giantDeckLabState(_deck))` (`:2326`) | mirrors pack output into `state`, so the lil-gui sliders stay live and `.listen()`-bound |
| `writePackUniforms(uniforms, giantDeckDirectDrivers(_deck), _dctx)` (`:1773`) | writes the complement — drivers the frame loop does not own — straight to the material |

⭐ **The mirror is what makes AC6 survivable.** Writing pack output straight to uniforms would take
the lab's authoring sliders out of the loop, which is the lab's entire purpose. ⚠ And the mirror must
carry the **UNGATED** value: the lab re-applies its own ✓ checkbox at the per-frame writer, so a
gated mirror applies the decision twice (`planet-lod-lab.html:1749` names this hazard).

✅ `solidFeatures.js` now exports both. Authoring `solidFeaturesLabState` +
`solidFeaturesDirectDrivers` is the mechanical half of this AC. All fourteen uniforms mirror into
`state`, so the direct set is EMPTY — worth stating, because `giantDeckDirectDrivers` derives itself
by subtraction and an empty complement is a result, not a missing step.

## 3. ⭐⭐ THE FINDING: which condition vector the pack is handed decides everything

The obvious move is to copy the giantDeck call site and hand the pack `_gcond`. **That is wrong here,
and it fails silently.**

| | built from | what it is |
|---|---|---|
| `_gcond` (`planet-lod-lab.html:1726`) | `_fp = DRIVER_PRESETS[preset]` — the **FROZEN** preset | radius-aware, seed-**deaf** |
| the lab's own 14 | `_dp = drawPresetConditions(preset, macroSeed)` — the **PER-SEED** draw | seed-aware, radius-**deaf** |

The lab's own comment at `planet-lod-lab.html:1935` says why `_dp` exists: *"a macro seed produces a
genuinely different WORLD (iron, volatiles, age, temperature) rather than the same physics with a
re-rolled noise field."* Handing the pack `_gcond` throws that away — every seed would render the
same volcanism, frost and temperature. **Nothing would be red.**

### Measured, 13 presets × 6 seeds = 78 solid body-seeds, 1092 comparisons

```
ROUTE B  per-seed _dp   — disagreeing 168
  uEdificeMaxHeight:60  uChaosRaftJitter:54  uGlacialFlowVigor:54
ROUTE C  frozen   _fp   — disagreeing 297   ⛔ the known-bad arm
  …the three above, PLUS uPlanetTempEq:42  uFrostMaxCoverage:24  uPldStrength:24
    uGlacialStrength:22  uVolcanismStrength:9  uCryoActivity:8
```

⚠ **Route C is measured on purpose as the known-bad arm.** Four instruments in this workstream were
broken rather than the thing they measured; the probe prints an explicit verdict line and would say
so if it could not separate the two arms.

**So the seam is `deriveConditionVector(_dp, u, radius)` — and that reduces AC5 from fourteen
uniforms to three.** Eleven of fourteen round-trip through the condition vector unchanged on all 78.

## 4. ⛔ THE ONE OPEN DECISION — AND IT IS ALREADY HALF-RULED, INSIDE THE LAB

All three survivors derive from `surfaceGravity`, and from nothing else:

- `labCore.js:863` `edificeMaxHeight = min(2.0, max(0.2, 1.0 / max(surfaceGravity, 0.05)))`
- `labCore.js:996` `glacialFlowVigor = clamp01(mix(0.4, 0.9, 1.0 - clamp01(surfaceGravity)))`
- `labCore.js:1009` `chaosRaftJitter  = mix(0.3, 0.8, 1.0 - clamp01(surfaceGravity))`

`deriveUniforms` uses the **canonical radius-BLIND** g. The condition vector carries a
**radius-AWARE** g. So the pack's three values differ from the lab's by exactly that.

⭐⭐ **THE LAB HAS ALREADY MADE THIS EXACT CONVERSION ONCE, AND SAID SO.**
`planet-lod-lab.html:1964` reads `state.surfaceGravity = deriveConditionVector(_dp, u, state.planetRadiusEarth).surfaceGravity;`
under the comment *"The radius-aware condition gravity, NOT deriveUniforms' canonical radius-blind g
… read by the uPerturb envelope (:5937) and the AC7 'surface gravity' readout (:4283); **both were
radius-deaf until this line changed**."*

So the lab already treats radius-aware as the correction — for the bulk relief envelope and for the
number it shows the author. **The three ∝1/g morphology terms were simply not brought along.** This
is not lab-law vs game-law; it is an inconsistency inside the lab, and the import-back closes it.

### What Max is actually being asked

⚠ It **moves lab pixels** on three morphology terms — taller/shorter shield volcanoes, more/less
chaos-raft displacement, bolder/softer glacial lineations — on small bodies, where radius-aware and
radius-blind g diverge most. AC3 says a conversion changes no pixels, so this cannot be landed
silently under it. It is the same shape as the crater-density conversion he ruled on 2026-08-22,
where the ruling REVERSED once the divergence was measured.

## 5. What is done and what is not

| | |
|---|---|
| ✅ pack chosen on evidence, not convenience | the only 0-conflict pack in the survey |
| ✅ mechanism read off the working precedent | the two-part mirror/direct split |
| ✅ the seam identified AND measured | route C refuted at 297 vs 168 |
| ✅ the residue reduced to one root cause | radius-aware vs radius-blind `surfaceGravity` |
| ✅ `solidFeaturesLabState` / `solidFeaturesDirectDrivers` | authored, 5 tests (`§H`), complement asserted EMPTY |
| ✅ the line-neutral lab edit | import on `:188` (third statement, before the trailing `//`); call site `:2074-2076`; eleven assignments neutralised in place. **6559 lines, unchanged** |
| ✅ debt row cleared, ceiling 11 → 10 | roster and ledger both down to six packs |
| ✅ AC6 live check | the lab loads, the pack drives, the [G] A/B flips exactly three values and nothing else |

## 6. ✅ MAX'S READ — the UAT gate, closed 2026-08-22

> **"One seems right to me."** — Max, on the [G] A/B, 2026-08-22.

Recorded in his words rather than translated into a verdict label. The adopted arm stands; the
radius-aware `surfaceGravity` is what the lab's three ∝1/g morphology terms derive from from here on.
The instrument below stays in the file — it is how the ruling is re-checkable, not scaffolding.

### The instrument he was handed

The [G] key A/B is in the lab (handler `planet-lod-lab.html:5566`, arm readout in the `#abBadge`
element at `:147`). It flips the three ∝1/g terms between the adopted pack arm and the old lab arm
and touches nothing else — verified live: the other eleven read byte-identical across a flip.

⭐⭐ **THE PARK IS `Europa (icy moon)`, AND THE INSTRUMENT IS THE RADIUS SLIDER, NOT THE KEY ALONE.**
Europa is the only preset whose F9 chaos and F17 glacial masters are both fully live
(`cryoActivity` 1.0, `glacialStrength` 1.0), and its canonical 0.5 R⊕ is exactly where the two arms
agree — which is why the preset table reads 0% divergence and why a key-press alone shows nothing
there. Dragging the radius is what separates them, and it separates them completely:

```
                         chaosRaftJitter   glacialFlowVigor
  old lab arm  (any R)        0.660             0.760      ← radius-DEAF, the slider does nothing
  pack arm  R=0.20 R⊕         0.744             0.844
            R=0.50 R⊕         0.660             0.760      ← canonical: the two arms meet
            R=2.00 R⊕         0.300             0.400
```

⚠ Where the KEY alone reads, at seed 1: `Lava (hot airless)` +60% shield-volcano height on
`volcanismStrength` 1.0, and `Ocean (temperate)` +51% height with +36% glacial vigor together.
⛔ Chaos rafts are NOT judgeable by key alone on any preset — every preset with a diverging radius
has `cryoActivity` ≈ 0, and the one with real cryo locks to canonical. That is the reason for the
radius-slider park, stated so nobody re-derives it.
