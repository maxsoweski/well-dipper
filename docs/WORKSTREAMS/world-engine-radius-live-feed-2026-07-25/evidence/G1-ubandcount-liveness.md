# G1 — Is `uBandCount` still reaching rendered output?

**Date:** 2026-07-25
**Method:** static call-graph closure over the shader source (GLSL has no indirect calls,
so reachability is decidable by reading) + a closed-form numeric sensitivity instrument
proven by a planted defect.
**Constraint honoured:** read-only on all `.js` / `.html` / `.glsl` sources. Nothing edited.

---

## VERDICT — (c) CONDITIONALLY LIVE

`uBandCount` is **not** dead. Three surviving consumers reach rendered pixels, but **all
three sit behind one gate: `uJetStrength > 0.0`** — the F25 "Jets & shear" feature.

> **Exact condition:** `uJetStrength > 0.0`
> ⇔ `state.jetsEnabled === true` **AND** `state.jetStrength > 0`
> ⇔ the **Jets (F25)** checkbox is ticked **AND** the preset's atmosphere is `h2-he`
>   (`state.jetStrength = _gas ? 1.0 : 0.0`, `_gas = _fp.atmosphere?.composition === 'h2-he'`).
>
> On **every solid preset** `jetStrength` derives 0, so `uBandCount` is inert there
> regardless of the checkbox. On the five gas presets with Jets enabled it is live.

`docs/NOW.md`'s "uBandCount retired" line is **half true and therefore misleading**: the
retirement removed the *band-value* consumer (the visible stripe ladder, now authored by
the climate-e5 writer's `aBand`). It did **not** remove the *jet-geometry* consumers.
Detail in §3.

---

## 1. The three surviving consumers, and what they do

All three live in `planet-lod-height.glsl.js`.

### 1a. `jetU()` — the zonal-wind profile (`:1512-1521`)

```glsl
      float jetU(float trueLat, float latC){
        ...
        float jet = sin(6.2831853 * 0.25 * latC * uBandCount);   // :1518
        float eq  = 1.6 * exp(-(trueLat * trueLat) / (uJetEqWidth * uJetEqWidth));
        return jet + eq;
      }
```

### 1b. `jetShearGate()` — the shear-magnitude proxy (`:1522-1534`)

```glsl
      float jetShearGate(float trueLat, float latC){
        ...
        float s = sin(6.2831853 * 0.25 * latC * uBandCount);     // :1530
        float aL = abs(trueLat) / uJetEqWidth;
        float eqFlank = 1.4142136 * aL * exp(0.5 - aL * aL);
        return min(1.0, s * s + 0.6 * eqFlank);
      }
```

### 1c. `jetsDisp()` — festoon window (`:1543-1574`, the `uBandCount` line is `:1570`)

```glsl
      float jetsDisp(float trueLat, float latC, vec3 pos){
        float u   = jetU(trueLat, latC);                          // :1550  -> consumer 1a
        ...
        float disp = uJetShearTurb * jetShearGate(trueLat, latC) * tn;   // :1564 -> consumer 1b
        ...
        float b = 0.25 * latC * uBandCount;                       // :1570
        float flank = smoothstep(0.08, 0.20, b) * (1.0 - smoothstep(0.30, 0.42, b));
        disp += uJetFestoon * flank * max(0.0, tn);
        return disp;
      }
```

`grep -rn "uBandCount"` over the whole repo (excluding `node_modules`) returns exactly
five code hits: the uniform declaration `planet-lod-height.glsl.js:352`, the three above,
the JS default `planet-lod-uniforms.js:350`, and the per-frame feed
`world-engine-lab.html:5904`. There are no others.

---

## 2. Call-graph closure — these functions ARE reached from the live material's `main()`

`grep -rn "jetsDisp\|jetU(\|jetShearGate\|zonalBandCol"` over the repo (minus
`node_modules`) closes the graph completely:

| callee | call sites | enclosing scope |
|---|---|---|
| `jetU` | `planet-lod-height.glsl.js:1550`, `:1851` | `jetsDisp`, `zonalBandCol` |
| `jetShearGate` | `planet-lod-height.glsl.js:1564` | `jetsDisp` |
| `jetsDisp` | `planet-lod-height.glsl.js:1869`, **`world-engine-lab.html:680`** | `zonalBandCol`, **fragment `main()`** |
| `zonalBandCol` | **`world-engine-lab.html:668`** | **fragment `main()`** |

The two roots are both inside the live planet material's fragment `main()`:

* `world-engine-lab.html:228` — `const fragmentShader = /* glsl */ \`` … `:229` — `${HEIGHT_GLSL}`
* `world-engine-lab.html:291` — `void main(){`
* `world-engine-lab.html:1463` — `const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });`

`main()` is opened at `:291` at six-space indent and no line in `291..760` matches
`^      \}` — i.e. `main()` is still open at `:668`/`:680`. (Verified with
`awk 'NR>=291 && NR<=760 && /^      \}/' world-engine-lab.html` → **no output**.)

### Root A — the full gas deck (`world-engine-lab.html:653-669`)

```glsl
        float bandMask = uBandStrength * provinceWeight(PROV_BANDS);   // :653
        if (bandMask > 0.0){
          ...
          albedoCol = mix(albedoCol, zonalBandCol(bandN, bandPos, vBand, vShear, vMush, vStorm), bandMask);   // :668
        }
```

Inside `zonalBandCol`, both `uBandCount` paths are re-gated on jets:

```glsl
        if (uJetStrength > 0.0){                                                  // :1850
          float u   = jetU(trueLat, latC);                                        // :1851
          ...
          float r0  = bandWarpField(jetRotY(pos, u * uJetSpeed * (ph0 - 0.5)));   // :1855
          float r1  = bandWarpField(jetRotY(pos, u * uJetSpeed * (ph1 - 0.5)));   // :1856
          r = mix(r0, r1, w);
        } else {
          r = bandWarpField(pos);                                                 // :1859
        }
        float bandVal = wBand + uBandWarp * 0.16 * r;                             // :1868
        if (uJetStrength > 0.0) bandVal += uJetStrength * jetsDisp(trueLat, latC, pos) * (0.25 + 0.75 * wShear) * 0.35;   // :1869
```

`bandVal` then drives `zone = smoothstep(0.34, 0.66, ...)` (`:1892`) and the zone/belt
colour mix (`:1899-1900`) — i.e. it lands on pixels.

### Root B — the jets **solo** path (`world-engine-lab.html:676-681`)

```glsl
        float jetSoloMask = uJetStrength * provinceWeight(PROV_JETS) * (1.0 - bandMask);   // :676
        if (jetSoloMask > 0.0){
          float jLat  = asin(clamp(N.y, -1.0, 1.0)) * 0.63661977;
          float jLatC = sign(jLat) * pow(abs(jLat), uBandLatPow);
          albedoCol *= clamp(1.0 + 1.2 * jetSoloMask * jetsDisp(jLat, jLatC, vPos), 0.4, 1.6);   // :680
        }
```

This root reaches `uBandCount` **even with the F24 bands feature switched OFF**
(`bandMask == 0` makes the `(1.0 - bandMask)` complement 1). It keys on
`uJetStrength` alone. `provinceWeight(PROV_JETS)` is **neutral** — `planet-archetypes.js:225`
`jets: { field: 2, polarity: +1, floor: 1.00 }` — so it never zeroes the mask.

### Answer to "is it gated behind `bandStrength = _gas ? 1.0 : 0.0`?"

**No — not the only gate, and not the binding one.** `state.bandStrength` gates
`uBandStrength` → `bandMask` → Root A. Root B deliberately bypasses `bandMask`. The gate
that binds *all three* `uBandCount` consumers is `uJetStrength`, fed at
`world-engine-lab.html:5915`:

```js
      uniforms.uJetStrength.value  = state.jetsEnabled ? state.jetStrength : 0.0;   // ✓ enable gate
```

with `state.jetStrength = _gas ? 1.0 : 0.0;` (`world-engine-lab.html:3296`) — the same
`_gas` h2-he test used for `bandStrength` at `:3272`, so *in practice* gas-only, but via a
different uniform. `state.jetsEnabled` defaults to `false` (`:2095`); it is an
operator/registry checkbox (`planet-archetypes.js:37`,
`jets: { enableKey: 'jetsEnabled', archetypes: ['gas-giant','hot-jupiter'] }`) and is
also force-cleared by the "Isolate plate relief" UAT view
(`world-engine-lab.html:2591`, `clutter` list).

---

## 3. What `:1864`'s "the old stripe was replaced" comment actually retired

```glsl
        // ── E5 #3a (AC10): the band VALUE is the writer's per-vertex bandNorm (wBand) — NOT an inline
        // latitude ladder. wBand already encodes the driver-organized jet COUNT (Rhines), the SIGNED
        // equatorial jet ..., per-seed band
        // phase, and the Ward pole-emphasis (>54° inversion). The old 0.25·latC·uBandCount stripe
        // ladder is removed — bands are now caused by climate-e5, exercisable by a headless test.
```

The claim is scoped to **the band VALUE**, and it is accurate about that one consumer:
`bandVal` now starts from `wBand` (the baked `aBand` attribute) instead of an inline
`0.25 * latC * uBandCount`. The *visible stripe count* now comes from the writer —
`src/worldengine/base/climate-e5.js:218` counts zero-crossings of `u(lat)` and returns it
as `bandCount` (`:293`, `:349`), surfaced to the lab as `state.e5BandCount`
(`world-engine-lab.html:2864`).

**It removed one of four consumers.** The three in §1 were introduced by the *earlier*
F25 jets increment and were left untouched — by design, per their own comment at `:1513`:
"sin on the SAME pre-warp stripe ladder F24 uses". They kept reading `uBandCount` because
at the time it *was* the band ladder.

**Net effect today: the jet ladder and the visible band ladder are two independent
frequencies that no longer have to agree.** `uBandCount` (round(12·R/rotH), clamp 3..16)
and the writer's Rhines `bandCount` are computed by different laws from different code.
Their divergence is a pre-existing coherence defect, not something this workstream causes
— but a rewire that moves one and not the other **widens** it. See §6.

---

## 4. Numeric proof that the surviving consumers are sensitive to the uniform

Reachability alone does not prove the uniform changes output — the terms could multiply
out. Instrument:
`/tmp/claude-1000/-home-ax/e817996c-8971-4b9d-b54c-2e1af9b1e76b/scratchpad/g1-ubandcount-sensitivity.mjs`
transcribes **only the noise-free arithmetic** of `:1518`, `:1530`, `:1570-1571` and
`latC` (`:1839`), factoring the fbm term `tn` out. No noise is reimplemented, so every
number below is the shader's own arithmetic, not a model of it.

**Pass/fail criterion:** LIVE ⇔ swapping `uBandCount` between two values the lab can
actually produce changes a closed-form quantity by **> 1e-6 absolute** at some latitude.
1e-6 is chosen because these are float32 uniforms in float32 arithmetic: above ~1e-7 the
difference is representable and propagates; at or below it is indistinguishable from
rounding. Actual deltas are reported so the margin is visible, not just the boolean.

```
Gas giant (Jovian)
  uBandCount frozen = 14   drawn-radius range [6, 14] -> [7, 16]   worst alt = 7
  derived: vigor=0.9873 jetShearTurb=0.2968 jetFestoon=0.4443 jetSpeed=0.8081
  max |d jetU|         = 1.7602e+0  at trueLat=-0.8195   SENSITIVE
  -> warp-domain rotation delta = 0.7112 rad (40.7 deg) on a unit-radius sphere
  max |d jetShearGate| = 1.0000e+0  at trueLat=-1.0000   SENSITIVE
  max |d festoonFlank| = 1.0000e+0  at trueLat=0.1960   SENSITIVE  (x uJetFestoon=0.4443)

Gas giant (Saturnian)
  uBandCount frozen = 11   drawn-radius range [6, 14] -> [7, 16]   worst alt = 16
  max |d jetU|         = 1.9706e+0  at trueLat=-0.5345   SENSITIVE
  -> warp-domain rotation delta = 0.7367 rad (42.2 deg) on a unit-radius sphere
  max |d jetShearGate| = 1.0000e+0  at trueLat=-1.0000   SENSITIVE
  max |d festoonFlank| = 1.0000e+0  at trueLat=0.1770   SENSITIVE  (x uJetFestoon=0.2475)

Ice giant (Neptunian)        uBandCount frozen = 3   range -> [3, 3]   all deltas 0.0000e+0  flat
Sub-Neptune (hazy)           uBandCount frozen = 3   range -> [3, 3]   all deltas 0.0000e+0  flat
Hot Jupiter (locked giant)   uBandCount frozen = 3   range -> [3, 3]   all deltas 0.0000e+0  flat
```

The three `flat` rows are flat **because the radius draw cannot move the count off the
clamp floor of 3**, not because the consumers are dead there. Control run (same
instrument, `uBandCount` 3 vs an arbitrary manual 8, which the `bandCount` GUI slider at
`world-engine-lab.html:4572` allows — range 2..20):

```
   max|d jetU| = 1.9831e+0
   max|d gate| = 1.0000e+0
   max|d flank|= 1.0000e+0
```

So the consumers are live on **all five** gas presets; only the *radius rewire's leverage*
differs.

### Physical significance of the `jetU` delta

`jetU`'s output enters as a **rotation angle** of the warp sampling domain:
`jetRotY(pos, u * uJetSpeed * (ph - 0.5))`, `|ph - 0.5| <= 0.5`. On Jovian that is a
**0.711 rad (40.7°)** difference in how far the noise domain is spun.
`bandWarpField` (`:1539-1541`) samples `fbmd(p, 4.0, 0.0)` at base frequency 1 in object
space with `R = 1.0` (`world-engine-lab.html:198`), so the finest (4th) octave has
wavelength `2π/8 ≈ 0.785` arc units. A 0.711 rad rotation moves the sample point
**0.91× the finest-octave wavelength** — the sampled field decorrelates essentially
completely. This is a visible-scale change, not a numerical tickle.

### Planted defect (instrument proof)

The instrument is re-run with `uBandCount` severed inside all three consumers and replaced
by a hard-coded `8` — i.e. hypothesis **(b) DEAD** made real. Every delta must collapse to
exactly 0, otherwise the instrument is keying on something else and its LIVE verdict is
worthless.

```
=== PLANTED DEFECT: uBandCount replaced by constant 8 inside all three consumers ===
  Gas giant (Jovian): dU=0 dGate=0 dFlank=0  ZERO (check correctly FAILS to detect a change)
  Gas giant (Saturnian): dU=0 dGate=0 dFlank=0  ZERO
  Ice giant (Neptunian): dU=0 dGate=0 dFlank=0  ZERO
  Sub-Neptune (hazy): dU=0 dGate=0 dFlank=0  ZERO
  Hot Jupiter (locked giant): dU=0 dGate=0 dFlank=0  ZERO

planted-defect result: PASS — the instrument reports exactly 0 when uBandCount is severed,
so its non-zero readings above are caused by uBandCount and nothing else.
restored (Jovian 14 vs 7): dU=1.7602e+0 dGate=1.0000e+0 dFlank=1.0000e+0 -> DETECTED
```

Break → check fails. Restore → check passes. The instrument has caught a known defect.

---

## 5. The feed under scrutiny (`world-engine-lab.html:3271-3278`)

```js
      const _gas = (_fp.atmosphere?.composition === 'h2-he');
      state.bandStrength = _gas ? 1.0 : 0.0;
      ...
      const _rotH = _fp.rotationHours ?? 24;
      state.bandCount = Math.min(16, Math.max(3, Math.round(12 * (_fp.radiusEarth ?? 1) / _rotH)));
```

`_fp = DRIVER_PRESETS[driverUI.preset]` (`:3166`, inside `applyDrivers` which opens at
`:2985`) — the **frozen** preset descriptor. The live drawn radius is
`state.planetRadiusEarth`, set from `drawPresetRadius(...)` at `:2998` and read by the
condition vector at `:2804` / `:2851` / `:2930`. So `:3278` is indeed frozen-fed.

`state.bandCount` has exactly four references: declaration `:2080`, this derivation
`:3278`, the GUI slider `:4572`, the uniform feed `:5904`. Nothing else consumes it.

The radius slider re-runs `applyDrivers()` on a 220 ms trailing debounce
(`:3930-3934`), and `radiusSeed` / `🎲 reroll radius` call it directly (`:3940-3941`), so
a rewire at `:3278` **will** re-derive when the radius moves. No extra plumbing needed.

---

## 6. Implication for the rewire agent

1. **Do not delete `uBandCount`.** It is live on gas presets with Jets enabled, through
   two independent roots. Removing it would silently flatten the jet profile, the shear
   gate and the festoon window to whatever constant replaced it.
2. **Rewiring `:3278` to `state.planetRadiusEarth` DOES change rendered output** — but
   only under `uJetStrength > 0`, i.e. gas preset + Jets ticked. Any A/B screenshot taken
   with Jets off will show **zero** difference and must not be read as "the rewire did
   nothing".
3. **Leverage is preset-dependent.** Jovian (frozen 14, drawn range → 7..16) and Saturnian
   (frozen 11, range → 7..16) move. Neptunian, Sub-Neptune and Hot Jupiter are pinned to
   the clamp floor of 3 across their entire drawn-radius range, so the rewire is a no-op
   there. **Pick Jovian or Saturnian for the A/B.**
4. **Coherence hazard — flag before rewiring.** The visible band count now comes from
   `climate-e5.js`'s Rhines wavenumber, whose radius input is *also* frozen:
   `world-engine-lab.html:2856` — `radius: (_fp.radiusEarth ?? 1) / 11.2` (same frozen `_fp`
   from `:2843`). Today both ladders are frozen, so they are at least *stably* mismatched.
   Making `uBandCount` live while `rebakeE5Bands`'s `drivers.radius` stays frozen means
   the jets would peak at latitudes the visible bands no longer sit at, and the mismatch
   would now *vary with the drawn radius*. **Either rewire both feeds together, or state
   explicitly that `:2856` is out of scope and record the widened divergence as a known
   defect.**
5. **`docs/NOW.md` needs a correction.** "uBandCount retired" is true only of the band
   *value* consumer. Suggested restatement: *"uBandCount retired as the band-value ladder
   (bands now authored by climate-e5's `aBand`); it survives as the F25 jet/shear/festoon
   stripe frequency behind `uJetStrength > 0`."*

---

## 7. Caveats — what this does NOT establish

* **No shader was executed.** There is no headless GL in this repo (`npm run` scripts are
  vite / vitest / node only; `node_modules` contains no `gl`, `headless-gl`, `puppeteer`
  or `playwright`), and starting a dev server is forbidden. Reachability is established by
  static call-graph closure — sound for GLSL, which has no function pointers, no virtual
  dispatch and no recursion — and sensitivity by exact transcription of the *closed-form*
  arithmetic. **The final "these pixels differ" step is inferred, not measured.** A live
  A/B screenshot on a Jovian preset with Jets enabled would close it.
* **The fbm factor `tn` is not modelled.** `jetShearGate` and the festoon flank are both
  multiplied by `tn` (a 3-octave fbm) before reaching `disp`. `tn` is a
  mean-zero-ish noise field, so it is ~0 on a measure-zero set, not identically 0 — the
  products are non-vanishing almost everywhere. But I did not compute `tn`, so I cannot
  quote an amplitude for those two terms' *final* pixel contribution. The `jetU`
  consumer's significance (§4, warp-domain rotation vs octave wavelength) does not depend
  on `tn` and is the stronger of the two arguments.
* **One `uTime` degeneracy, harmless.** At instants where `fract(uTime * 0.04) == 0`,
  `w = 1` and the two rotated phases collapse so the `jetU`-driven rotation contributes
  nothing (`:1852-1857`). `jetShearGate` (`:1530`) and the festoon flank (`:1570`) carry
  no `uTime` and stay live at every instant, so `uBandCount` never fully drops out.
  `uTime` is fed from the real clock at `world-engine-lab.html:6112`.
* **Not checked: the game.** `HEIGHT_GLSL` has no importer under `src/` — only
  `world-engine-lab.html:162`, `planet-lod-rivers.js:16` (which builds
  `HEIGHT_FRAG = HEIGHT_GLSL + ROUTER_MAIN` and never calls `zonalBandCol`/`jetsDisp`),
  and `rivers-terrain-lab.html`. So this is a lab-only finding, consistent with the
  planet-lod charter's lab≠game split. The game's own gas banding is the unrelated
  `src/objects/Planet.js` `GAS_BODY` const pattern.
* **Not checked: whether any *default* lab session has Jets on.** `state.jetsEnabled`
  defaults to `false` (`:2088`/`:2095`) and I found no code path that flips it true from a
  preset selection — the registry `archetypes` list at `planet-archetypes.js:36-37` drives
  panel *filtering*, and `world-engine-lab.html:2586` states outright "there is NO setPreset
  that re-applies `*Enabled`". If the operator never ticks Jets, `uBandCount` is inert in
  practice even on a Jovian. I could not rule out a URL-parameter or console
  (`window._lab`) path that enables it; I did not exhaustively audit those.

---

## Reproduction

```bash
cd /home/ax/projects/well-dipper
grep -rn "uBandCount" --include=*.js --include=*.html --include=*.glsl . | grep -v node_modules
grep -rn "jetsDisp\|jetU(\|jetShearGate\|zonalBandCol" --include=*.js --include=*.html . | grep -v node_modules
awk 'NR>=291 && NR<=760 && /^      \}/ {print NR": "$0}' world-engine-lab.html   # empty => main() still open at :680
node /tmp/claude-1000/-home-ax/e817996c-8971-4b9d-b54c-2e1af9b1e76b/scratchpad/g1-ubandcount-sensitivity.mjs
```
