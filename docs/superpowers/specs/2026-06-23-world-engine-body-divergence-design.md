# World-Engine Relief Slice — Body-Type Divergence Design

**Date:** 2026-06-23
**Status:** DESIGN — pending Max review
**Scope:** Isolated lab proc-gen only (`relief-*.js` + `world-engine-relief-lab.html`/`.main.js` + `tests/world-engine-relief-slice.test.js`). **Renderer untouched. Additive on `master`. No production edits.**
**Linkable from:** `docs/FEATURES/world-engine-INDEX.md` (the master pickup map). This is the "extend the *lab* slice" option named in INDEX §1 NEXT (3).

---

## 1. Why

### The payoff

The relief slice proved the host-editor mechanism (E6 tectonic *build* → E9 hydrology *carve*, one shared substrate, UAT-passed `90b66f7`). But Max's UAT on **2026-06-23** surfaced a real limit: the four body presets (Rocky / Lava / Magma / Europa) **change only AMPLITUDE, not structure**. At a fixed seed every preset renders the *same* landform layout, rescaled in height — a "coat-swap," not different worlds.

This design makes different body types produce **categorically different worlds**, working ONLY at the proc-gen layer. It does this by making physics drivers shape the **field generation itself** (seed, frequency, anisotropy, regime), not just post-scale it.

### Tie to the north star

The world-engine north star (INDEX §1, `planet-lod-CHARTER.md`): *bodies look distinctive because features share **engines** rooted in the body's **history + composition + place** in the system.* Today the engines run on the same field regardless of composition, so the "rooted in composition" half is unfulfilled. This design routes composition/thermal/orbital drivers into the field's geometry so a contraction-driven rocky world and an extension-driven icy/molten world are **genuinely different DEMs at one master seed** — the engine, not a palette, carries the divergence.

### What success looks like

- **Objective:** with E9 (carve) disabled, two body bundles produce E6-only DEMs whose **host-field divergence** (a distribution distance on the height field at the SAME master seed) rises from ~0 (today) to above a to-be-tuned threshold. This is the pass/fail line that distinguishes "different worlds" from "same world rescaled."
- **Experiential (Max's gate alone):** three bundles read as **three categorically different worlds** at one seed — a well-drained tectonic-rock world, a bare-but-regime-distinct airless/molten world, and a temperate wet world with a real river network. No agent closes UAT.

---

## 2. How the proc-gen works today + the coat-swap finding

### The pipeline today

`runReliefSlice` (`relief-slice.js:22-38`): `makeBaseStep` derives drivers → **E6** (`runE6`) writes height across the despin-banded grain + plateau blobs → **E9** (`runE9`) subtracts a fluvial drainage network from the same height. Presets feed real physics-derived drivers (`relief-base-step.js`), but those drivers reach only two *scalar* levers:

- **E6 amplitude** — `baseAmp = 0.6 * gCap * (0.3 + 0.7 * silicate)` (`relief-e6-tectonic.js:78`), where `gCap` is the isostatic gravity cap and `silicate = rockyCrust` (`relief-base-step.js:28`).
- **E9 erodibility** — `0.18 * clamp01(0.3 + 0.7 * surfaceHistory.erosion)` (`relief-e9-hydrology.js:108`).

### The coat-swap finding (the failure being fixed)

An adversarial check (research file, skeptic `verdict: "fails"`) confirmed gating the two engines ALONE is a coat-swap, for three independent reasons grounded in the code:

1. **The host FIELD is byte-identical in layout across bundles.** E6 seeds noise as `alea(seed + ':e6:' + epoch.name)` and `alea(seed + ':e6plateau')` (`relief-e6-tectonic.js:72-74`) — the bundle is **excluded** from the seed. The crustal-thickness blob is seeded `alea(seed + ':crust')` (`relief-base-step.js:46`) — also bundle-blind. The grain is **latitude-only** (`writeGrain` over `latDegOfRow`, `relief-e6-tectonic.js:34-46`). So only the scalar `baseAmp` and `radialStrain*` vary; the LAYOUT is fixed. The `relief-presets.js:18` BUILD-INTENT block already concedes this: *"Same seed + different preset = IDENTICAL landform layout, only rescaled in height."*

2. **The one qualitative lever is damped to inertness.** `radialStrainMag` is capped at `* 0.001` (`relief-base-step.js:38`), making `eps ≈ 5e-4` in stress units (`relief-e6-tectonic.js:21`) against a despin stress span of order `(1 + ν) = 1.25`. That is ~1000× too small to cross an Anderson regime boundary (`relief-e6-tectonic.js:25-27`), so the contraction-vs-expansion regime **never flips** — `steeredNoise` (`relief-e6-tectonic.js:61-67`) stays a ridge/groove micro-texture inversion on identical blobs.

3. **E9 has no liquid-stability gate.** `runE9` reads NEITHER `T_eq` NOR `volatileFraction`; ocean fraction is hardcoded `targetFrac = 0.4` (`relief-e9-hydrology.js:115`). A 950 K lava world carves with the same algorithm as a 288 K rocky world (`relief-e9-hydrology.js:131`, no temp/volatile term). So "wet world carves vs airless world bare" is just the same blob ± a river overlay.

**The fix this design encodes:** physics drivers must shape the FIELD GENERATION (seed, frequency, anisotropy, regime) — not merely post-scale it. Gating the engines is necessary but not sufficient; field re-keying (Layers 1–3) is the load-bearing part.

---

## 3. Design — Approach A, built in 5 testable layers

Each layer changes **one** generative lever, **holds the others off** (so any measured effect is attributable to that lever — the isolated-harness discipline), and has its own gate metric. Decisive field-shaping comes **first**; the intuitive liquid gate comes **after** (because gating alone is the coat-swap).

> **Tuning discipline.** Every constant named below (`REGIME_GAIN`, the host-field-divergence threshold, terrestrial-bundle numbers) is **TO-BE-TUNED-IN-LAB-then-locked** — set in the harness so the divergence metrics clearly separate the bundles, then frozen. None of the values here is presented as calibrated.

> **Record-build-intent discipline.** Every module the implementer creates or edits carries a `Function / Intent / Deliberate non-goals` header (the pattern already in `relief-slice.js:5-16` and `relief-presets.js:7-26`). State, per layer, what the lever IS, why it is faithful, and what is held off — so no future session re-derives it from code.

### Layer 1 — Un-damp the strain so the tectonic REGIME flips

- **The one lever:** the magnitude of the radial-strain term, so the Anderson regime (`relief-e6-tectonic.js:25-27`) actually changes class per body.
- **Code location(s):** `relief-base-step.js:38` (drop the `* 0.001` damping); `relief-e6-tectonic.js:21` (couple `eps` to the despin span, not a literal areal-strain height).
- **Faithful derivation:** the SIGN is already correctly derived and varies per body — `expansionDrive = clamp01(log10(1 + tidalHeat) / 2)`, `contractionDrive = clamp01(0.4 + 0.6*age) * clamp01(surfaceGravity / 1.5)`, `radialStrainSign = contractionDrive >= expansionDrive ? +1 : -1` (`relief-base-step.js:35-37`). Keep that. Only the magnitude→eps mapping changes. Express `eps` as a fraction of the despin stress span so it is regime-relevant *by construction*:

  ```
  // relief-base-step.js: drop the *0.001; mag stays the un-damped strainDrive 0..1
  radialStrainMag = clamp01(abs(contractionDrive - expansionDrive))   // 0..1

  // relief-e6-tectonic.js stressAtLat: bound eps to a fraction of the despin span
  const REGIME_GAIN = /* TO-BE-TUNED-IN-LAB-then-locked */;           // ≤ ~0.8: SHIFTS bands, never saturates
  const span = (drivers.despinAmp ?? 1) * (3 + NU);                   // ≈ despin sMer range
  const eps  = (drivers.radialStrainSign ?? +1) * (drivers.radialStrainMag ?? 0) * span * REGIME_GAIN;
  sMer += eps; sZon += eps;
  ```

  `eps` bounded to `< span` keeps the Melosh latitude bands as the substrate — strain biases *which* bands are scarps vs grabens rather than collapsing all bands into one regime. This is exactly P2's documented intent: the same drivers under different sign select different feature sets (`planet-visual-features.md:143` P2 drivers `D16 cooling→contraction` / `D2 ice-shell extension`; `:220` F5 lobate-scarp/wrinkle-ridge (compression) vs horst-and-graben (extension); `:219` F4 tectonic graben/chasma (extension)). The renderer needs no change: `steeredNoise` already swaps ridges vs grabens on `regime === NORMAL` (`relief-e6-tectonic.js:66`), so a regime flip auto-swaps morphology.
- **Held OFF:** seed re-key, pattern-branch (frequency/anisotropy), the liquid gate, the new bundle.
- **Gate metric:** **regime-class histogram** diverges — rocky (sign +1) becomes THRUST-dominant (scarps); magma/europa (sign −1) become NORMAL-dominant (grabens). With the `* 0.001` damping this histogram is near-identical across all four presets, so it is the cleanest detector of whether the un-damp worked.
- **Passing proves:** the regime lever is alive, not inert.

> ⚠ **Honest caveat (from the research, must be tuned around):** `age` is absent from all 4 presets (default `0.5`, `relief-base-step.js:30`), so today only `surfaceGravity` + `tidalHeat` differentiate the sign. With the un-damp, the per-probe spread is **rocky → +1 (contraction)**, **lava/magma/europa → −1 (expansion)** — a 1-of-4 sign flip. That is enough for the rocky-vs-icy/molten contrast this design targets, but a richer 4-way regime spread would need real ages OR leaning the contraction proxy harder on gravity/density. Flag to Max during tuning; do not silently rely on `age`.

### Layer 2 — Branch steered-noise FREQUENCY / ANISOTROPY by regime

- **The one lever:** the spatial geometry of the steered noise — contraction → long, low-frequency scarp lineaments; extension → blockier graben fields.
- **Code location(s):** `relief-e6-tectonic.js:61-67` (`steeredNoise` along/across-strike frequencies `* 0.35` / `* 1.6`) and `relief-e6-tectonic.js:85` (the `9.0` freq passed to it). Branch these by `substrate.regime[i]` / `drivers.radialStrainSign`.
- **Faithful derivation:** `steeredNoise` already samples in a frame rotated to the grain angle, stretched along strike (`relief-e6-tectonic.js:62-64`). Layer 2 makes the stretch ratio and base frequency **regime-dependent**: a contraction regime gets a lower base frequency and a higher along-strike elongation (long parallel scarp ridges, F5 wrinkle-ridge geometry); an extension regime gets a higher base frequency / blockier aspect (graben spacing, F4/F5 horst-and-graben). The exact ratio constants are **TO-BE-TUNED-IN-LAB-then-locked**. This is geometry, not polarity — it changes the *shape* of the lineament field, beyond the ridge/groove inversion Layer 1 already gets from `relief-e6-tectonic.js:66`.
- **Held OFF:** seed re-key (Layer 3), the liquid gate, the new bundle.
- **Gate metric:** **host-field divergence with E9 OFF** rises **above ~0** between a contraction bundle and an extension bundle. (Layer 1 only changes regime *class*; Layer 2 is the first lever that should move the field *geometry* metric off zero.)
- **Passing proves:** field GEOMETRY differs, not just texture polarity.

### Layer 3 — Re-key E6's noise + crust SEED with a physics discriminator

- **The one lever:** the master-seed inputs to the field, so the host DEM **layout** itself differs per body.
- **Code location(s):** `relief-e6-tectonic.js:72-74` (the `:e6:` and `:e6plateau` noise seeds) and `relief-base-step.js:46` (the `:crust` thickness-blob seed).
- **Faithful derivation:** fold a **physics discriminator** into each seed string — e.g. `seed + ':e6:' + radialStrainSign + ':' + (rockyCrust > 0.5 ? 'sil' : 'ice')`. The discriminator is derived from the SAME geophysical quantities already computed (`radialStrainSign`, `rockyCrust` at `relief-base-step.js:28,37`), so it is not invented physics — it is making the field's *layout* a function of composition/regime, which is what "rooted in composition" requires. A contraction-world and an extension-world (and a silicate vs an icy world) now draw from different noise streams → different blob/lineament placement at the same master seed.
- **Held OFF:** the liquid gate, the new bundle.
- **Gate metric:** **host-field divergence (E9 OFF)** rises **further** → visibly distinct DEM layouts between bundles at one master seed.
- **Passing proves:** different bodies = genuinely different maps at one master seed — this is what **escapes the coat-swap**.

> **EARLY-EXIT RULE (cheap-signal stop).** If Layers 1–3 together cannot move host-field divergence above the tuned threshold, **STOP**. That is the cheap signal that the relief + fluvial vocabulary is too thin to carry categorical divergence, and a genuinely **new process** (breadth — e.g. impact cratering E8a, aeolian E10, cryosphere E11) is needed before more field-shaping. Do not death-spiral on re-keying.

### Layer 4 — Add the `liquidStability` gate (mirror production) → E9 on/off + strength

- **The one lever:** whether (and how strongly) E9 carves, gated on liquid stability — the intuitive wet-vs-airless axis, added AFTER the field is already distinct.
- **Code location(s):** derive in `makeBaseStep` (`relief-base-step.js`, beside the existing `tidalHeat`/`rockyCrust` derivations); consume in `runE9` (`relief-e9-hydrology.js:108` erodibility, `:115` the hardcoded `targetFrac = 0.4`, `:119-137` the incision loop).
- **Faithful derivation — copy the canonical production formula verbatim; do NOT invent physics.** Production already has the canonical gate: `liquidStability = clamp01(retentionGate * volatileGate * tempWindow)` (`planet-lod-lab-core.js:561`), the AND of three soft gates. Mirror it:
  - **Temp + volatile gates — copy EXACTLY** (`planet-lod-lab-core.js:547-560`; `clamp01`/`smoothstep` already imported at `relief-base-step.js:9-10`):
    ```
    const T = d.T_eq ?? 280;
    const volatileFraction = d.composition?.volatileFraction ?? 0.15;
    const volatileGate = smoothstep(0.05, 0.2, volatileFraction);                 // D2
    const waterWindow   = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T));
    const methaneWindow = smoothstep(85, 90, T)   * (1 - smoothstep(112, 120, T));
    const tempWindow = Math.max(waterWindow, methaneWindow);                       // D1
    ```
  - **Retention gate (D6) — reconstruct from bundle fields production itself uses**, since the relief bundles carry no `atmosphere` object (the one real input gap — see §7). Mirror `computeAtmosphere`'s Jeans physics rather than its full branch tree: `T_exo = 3.5 * T_eq` (`PhysicsEngine.js:111`); a Jeans-parameter test `λ > 6` on N₂/CO₂ at `T_exo` (`PhysicsEngine.js:96-100,184-187`) for `retained`; map `retained → pressure` the way the secondary-atmosphere branch does (`PhysicsEngine.js:218-239`); feed it into the production gate UNCHANGED: `retentionGate = retained ? smoothstep(0.05, 0.3, pressure) : 0` (`planet-lod-lab-core.js:546`).
  - **Combine identically** (`planet-lod-lab-core.js:561-562`): `liquidStability = clamp01(retentionGate * volatileGate * tempWindow)`; `liquidSpecies = methaneWindow > waterWindow ? 1 : 0`.
  - **E9 strength** mirrors production `precipitation = clamp01(liquidStability * rainFactor)` (`planet-lod-lab-core.js:585-591`). Since the bundle lacks the atmosphere composition string, derive `rainFactor` from the reconstructed atmosphere branch (`waterWindow > 0 && retained ? 1.0 : retained ? 0.2 : 0`) — a documented proxy, not invented physics.
  - **Wire into E9:** in `runE9`, early-return the incision loop when `liquidStability <= 0`, scale `erodibility *= liquidStability` (replacing the hardcoded path at `relief-e9-hydrology.js:108`), and derive `targetFrac` from `liquidStability` instead of the hardcoded `0.4` (`relief-e9-hydrology.js:115`). This is the **missing twin of the `rockyCrust` silicate gate** already at `relief-base-step.js:28`, applied to fluvial — mirroring Appendix A's intent (`planet-visual-features.md:400` F-gradational row marks **lava `–`** / not-applicable; `:233` F11 rivers gated to terrestrial/ocean/ice/carbon).
- **Held OFF:** the new temperate bundle (Layer 5).
- **Gate metric:** **carve-fraction** ≈ 0 on airless (lava/magma) vs high on wet (rocky/terrestrial); **drainage density** differs between bundles.
- **Passing proves:** the wet-vs-airless axis is real; kills the hardcoded-`0.4` ocean.

### Layer 5 — Add the temperate "terrestrial" bundle

- **The one lever:** a temperate liquid-water body, so a clean three-way wet/frozen/airless trio exists (the existing four skew hot/airless — only rocky is temperate; see §5).
- **Code location(s):** `relief-presets.js:27-32` (add a `terrestrial` entry).
- **Faithful derivation:** §5 specifies the concrete fields and why.
- **Held OFF:** nothing — this is the assembly layer.
- **Gate metric:** full trio (e.g. terrestrial wet / europa frozen / lava airless) renders at one seed + **Max UAT**.
- **Passing proves:** three categorically different worlds at one seed.

---

## 4. The "terrestrial" bundle to add

Add ONE temperate liquid-water body to `relief-presets.js`. **All numbers TO-BE-TUNED-IN-LAB-then-locked** (targets, not calibrated values):

```js
terrestrial: {
  composition: { ironFraction: 0.33, density: 5.5, volatileFraction: 0.4 },  // density 5.5 → rockyCrust=1 (silicate)
  T_eq: 290,                  // mid water-window (248–398 band, planet-lod-lab-core.js:558)
  eccentricity: 0.01,         // low ecc → contraction-leaning sign (small tidalHeat)
  orbitRadiusEarth: 23455,    // ≈ Earth, with starMassEarth 332946
  starMassEarth: 332946,
  radiusEarth: 1.0, massEarth: 1.0,   // ≈ Earth mass/radius
  surfaceHistory: { erosion: 0.6 },   // active erosion budget → strong E9 carving
}
```

**Why it is needed.** The four existing bundles skew hot/airless: rocky (`T_eq 288`) is the **only** temperate one; europa is cold-FROZEN (110 K — methane band, not water); lava (950 K) and magma (2000 K) are airless-hot. With a faithful `liquidStability` gate (Layer 4), only ONE existing preset (rocky) qualifies as wet — you cannot build a 3-way wet/frozen/airless contrast from the existing four. The terrestrial bundle gives the clean third pole: density 5.5 → `rockyCrust = 1` (full silicate amplitude, `relief-base-step.js:28`); `volatileFraction 0.4` + `T_eq 290` → `liquidStability ≈ 1` (full water window × full volatile gate); `erosion 0.6` → strong carving. Result: **terrestrial carves a full river network (F11), europa/airless carve nothing** — a true categorical wet/frozen/airless split, not three intensity regimes of one map.

---

## 5. Divergence verifier

A lab-only verifier (extends `tests/world-engine-relief-slice.test.js` and/or the harness) computes **four metrics** between bundles at the SAME master seed, reading the existing substrate arrays (`relief-substrate.js:9-17`):

1. **Carve-fraction** — fraction of land cells with `incision[i] < -ε` after `runE9` (the returned `incision` array, `relief-e9-hydrology.js:147`). Expect ≈ 0 on gated-off (airless/frozen) bodies, substantial positive on wet bodies. Proves the on/off gate fires — **not sufficient alone** for categorical divergence.
2. **Drainage density** — count of channel cells (`substrate.flowAccum` above a fixed percentile, `relief-e9-hydrology.js:123`) per unit land area, at the fixed seed. Compares river-network richness; ≈ 0 for gated-off worlds.
3. **Regime-class histogram** — per-cell tally of `substrate.regime` over `REGIME {NORMAL, STRIKESLIP, THRUST}` (`relief-substrate.js:3`, written `relief-e6-tectonic.js:44`). A genuine scarp-vs-graben divergence requires THRUST-fraction (contraction bundle) vs NORMAL-fraction (extension bundle) to differ meaningfully. The cleanest detector of whether Layer 1's un-damp worked (today near-identical across all four).
4. **Host-field divergence — THE DECISIVE GATE.** With the E9 carve overlay **DISABLED**, compute a distribution distance between two bundles' E6-only DEMs (`substrate.height`, `relief-substrate.js:9`) at the SAME master seed:
   - a **Wasserstein/KS distance** on the hypsometric height histogram, **plus**
   - a **per-cell RMS height difference normalized by relief range**.

   This is **~0 today** (identical layout, only a global amplitude scale — proving the coat-swap). It only becomes non-trivial after Layers 2–3 re-key the field. **Pass/fail line:** host-field divergence **above the to-be-tuned threshold** = "categorically different worlds"; at/near ~0 = "same world rescaled" (FAIL). The threshold is **TO-BE-TUNED-IN-LAB-then-locked**, set just above the noise floor of identical-bundle runs.

**EARLY-EXIT RULE (restated as the verifier's stop condition):** if after Layers 1–3 the host-field-divergence metric cannot clear the tuned threshold, STOP field-shaping and escalate to a new process (breadth) — the cheap signal that relief+fluvial alone is too thin.

---

## 6. Honest non-goals / scope caveats

- **No craters / no aeolian.** The airless world (lava/magma) is **bare-but-now-regime-distinct**, NOT cratered. The single most recognizable airless-body signature — impact craters (P1/F2) — is absent from this slice, as is wind (P9/F9... aeolian). **This limits how "finished" an airless world reads**: a reviewer may read despin-banded regime-distinct rock as incomplete rather than convincingly airless. Adding craters/aeolian is **breadth** (a new process), deferred behind the §3/§5 early-exit rule, not part of this design.
- **`uvStripFactor` dropped in the retention reconstruction.** Production's `computeAtmosphere` includes a UV-sputter term needing `uvFlux = luminosityRel / orbitAU²` (`PhysicsEngine.js:180-181`); the relief bundle carries no `luminosityRel` / `orbitAU`. The Layer-4 reconstruction **drops `uvStripFactor`** — a **documented simplification**, not a silent one. It may mis-gate borderline bodies and is not bit-faithful to production; the bundles' clearly-temperate/clearly-airless presets are well inside the gate's margins, so this is acceptable for the lab. Flag if a borderline bundle is ever added.
- **Palette stays height-only.** No preset-aware coloring (europa is still NOT icy-colored; `relief-presets.js:22`). Divergence here is **structural** (field geometry + carve), not chromatic. A palette engine (E12) is a separate, later track.
- **Breadth deferred.** New processes (E8a bombardment, E10 aeolian, E11 cryosphere), sphere/cubemap mapping (still a flat 2D latitude-band DEM, `relief-slice.js:13`), and the GPU FastFlow bake (`relief-e9-hydrology.js:1-3`) are all out of scope.
- **Isolated lab, renderer untouched, additive on `master`.** Zero production edits. No render hacks, no tacked-on visual features — the renderer is preset-blind by construction and MUST stay that way. Production L1 wiring is a separate high-blast-radius branch (INDEX §1 NEXT).

---

## 7. The one real input gap

The relief bundles (`relief-presets.js`) carry `composition` / `T_eq` / `orbit` / `mass` but **no `atmosphere: { retained, pressure, composition }` object**, which the canonical `liquidStability` formula reads for its D6 retention gate and rainFactor. Production gets this from `PhysicsEngine.computeAtmosphere`; the lab reconstructs `retained`/`pressure` from `T_eq` + mass/radius via the Jeans chain (§3 Layer 4), dropping `uvStripFactor` (§6). This is the ONE genuine gap; the temp + volatile gates copy production verbatim with no gap.

---

## 8. Build order = the 5 layers, TDD per layer

Build the layers **in order**, one generative lever at a time, **TDD per layer** (`superpowers:test-driven-development`): write the gate-metric test RED → implement the single lever GREEN → **verify the metric** in the harness/verifier (host-field divergence is the load-bearing check after L2/L3) → only then stack the next layer. Holding the other levers off per layer is what makes each measured effect attributable. Honor the §3/§5 **early-exit rule** after L1–L3.

Each new/edited module carries a `Function / Intent / Deliberate non-goals` header (record-build-intent discipline, §3).

---

## 9. Success gate

- **Objective (the pass/fail line):** **host-field divergence above the tuned threshold** (§5 metric 4) between bundles at one master seed, with E9 disabled — proving categorically different worlds, not the coat-swap.
- **Experiential (Max's gate alone):** Max UAT confirms **"three different worlds"** at one seed (terrestrial wet / europa frozen / lava airless). **No agent closes UAT** — the verifier marks the UAT layer as deferred-to-Max; integration-green → `VERIFIED_PENDING_MAX <sha>` → Max does UAT → Shipped.
