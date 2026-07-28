# Inc-3 BUILD-PLAN — relief-scale spine + crater depth-law correction

> ⚠ **SUPERSEDED IN PART (gravity-selfcompression-2026-07-28).** Passages below describing `g = g_c·(R/R_c)` record the CONSTANT-DENSITY law that was live when this document was written. Gravity is now `g = g_c·f(R)/f(R_c)` with `f` piecewise in absolute Earth radii (`R^(4/3)` below 1 R⊕, `R^1.70` above), applied to the **rocky class only**; gas, icy and carbon presets are unchanged. Byte-exactness at canonical is unchanged. Kept as written for audit trail — do not read it as current behaviour.


Workstream `world-engine-inc3-relief-spine-depthlaw-2026-07-21` · L1 tree,
`feature/world-engine-production-L1`. Companion to `contract.json` (the ACs),
`intent.md` (the why), `MATH-CHECK-2026-07-21.md` (the convicting numbers).
Anchors are **symbols** (durable-doc discipline); line numbers appear only as
transient "current location" hints.

**Line of sight (feature → driving outcome):** the World-Engine charter's
condition-first promise is that a *drawn* world reads as the body its scalars
describe. v2-6 made the drawn radius load-bearing but Max's UAT found low-g/low-R
Moon/Mercury/Frozen read *"like magma… wavey"*. This increment closes that UAT
finding — the last blocker between "radius is wired" and "a small airless world
looks like a small airless world" (Player-Experience tier: *believable worlds*).

---

## (0) GROUND TRUTH — what EXISTS today vs what CHANGES

> The audit (driver-wiring-audit-2026-07-19 §3 Inc-3) assumed the relief spine
> *did not exist*. It does. The math check found a **live** `reliefNorm`. This
> section proves every seam before a line is specced (v2-4 lesson, designDecision 6).

### 0.1 The relief multiplier (`reliefNorm`) — EXISTS, live, defective

**Seam:** `planet-lod-lab.html` → `function reliefNorm(heightKm, radiusEarth, surfaceGravity)`
(currently ~L1971), built from two core helpers imported at `planet-lod-lab.html`
L151:

- `planet-lod-lab-core.js` → `reliefAmplitudeFromKm(featureHeightKm, radiusEarth)`
  `= featureHeightKm / (radiusEarth · R_EARTH_KM)` — **no clamp** (the uncapped term).
- `planet-lod-lab-core.js` → `reliefGravityFactor(surfaceGravity)`
  `= clamp(g^-0.5, 0.4, 2.5)` — bounded, sign-correct.

`reliefNorm` collapses to **`(1/RE) · reliefGravityFactor(g)`** because the
`heightKm` cancels in `here/ref` (proven in the source comment at
`reliefNorm`). Reproduced numerically in `calibration/relief-envelope.mjs`:
at the convicted worked point `(R=0.27, g=0.28)` → `3.704 · 1.890 = 6.999×`
(math-check's 7.0×). The `(1/RE)` factor is **unbounded** → 18.9× at R=0.1,
63× at R=0.03.

**What CHANGES:** `reliefNorm`'s `(1/RE)·gCap` product is replaced by a derived,
bounded strength-cap **`reliefEnvelope(R, g)`** (new core export). The `(1/RE)`
term is *dropped* (see the Derivation Note §1). `reliefGravityFactor` and
`reliefAmplitudeFromKm` are **NOT edited** (shared + separately tested — §0.4).
This is **render-side** (the function is called per-frame in the lab uniform
block); it touches **no carrier byte**.

### 0.2 How the multiplier ACTUALLY reaches the render — EXISTS, and it is applied via TWO paths (double-application) — CORRECTED post-lens

> **Lens correction (mechanism MF1, source-verified).** The pre-lens plan treated
> `reliefNorm` as reaching only the five uniforms below and proposed *wiring more
> families*. That misses the seam. There is a **second, universal application
> point**, and it changes the whole S1 strategy.

**Path A — per-family amp uniforms carry `reliefNorm`** (grep of `reliefNorm(` in
the per-frame uniform block, `planet-lod-lab.html` ~L5602–6002). Five uniforms:

| Uniform (symbol) | Height arg | gravity arg | note |
|---|---|---|---|
| `uPerturb` | `mountainHeightKm` | `_gNow` | the GLOBAL relief strength (see Path B) |
| `uEcuCanyonDepth` | `canyonDepthKm` | `_gNow` | F49 street-canyon depth |
| `uCraterAmp` | `craterDepthKm` | `_gNow` | in-shader **F2 synth** crater channel |
| `uMountainAmp` | `mountainHeightKm` | `_gNow` | ×enable ×exotic ×relevance |
| `uEdificeAmp` | `edificeHeightKm` | **`1.0`** | g passed as 1.0 ⇒ `reliefNorm` collapses to `(1/RE)` (radius-only). |

**Path B — `uPerturb` is the UNIVERSAL normal-bend strength for the ENTIRE
accumulated gradient.** In the analytic branch the base FBM gradient plus *every*
combiner (`mountainCombiner`, `craterCombiner`, `canyonCombiner`, `ecuRelief`,
`edificeCombiner`, `cryoRidgeCombiner`, … all `grad += …`) sum
into a single `grad`, then:

```
float reliefAmp = uPerturb * mix(0.7, 1.0, uLodRamp);   // planet-lod-lab.html:536
shadeN = perturbAnalytic(N, grad, reliefAmp);            // :537
// perturbAnalytic: perturbed = normalize(N - gTan * strength * 0.6)  (glsl :1482)
```

so **the whole `grad` is scaled by `reliefAmp = uPerturb·mix`, and `uPerturb`
carries `reliefNorm`.** (The finite-diff regression path, `perturbFiniteDiff(N,
vPos, uPerturb)` at L368, is likewise `uPerturb`-scaled.)

**Consequence — the current render double-applies `reliefNorm` on three families:**

- `uMountainAmp`, `uCraterAmp`, `uEcuCanyonDepth` each add `amp·(…)` to `grad`
  (glsl L1479 / L1968 / L2781) — `amp` carries `reliefNorm` — and then the sum is
  scaled **again** by `uPerturb` (also `reliefNorm`) ⇒ these render at
  **`reliefNorm²`** (≈49× at the worked point, not 7×). `uEdificeAmp` squares its
  **radius** half the same way (`(1/RE)·uPerturb`).
- Every **raw pass-through** family (`uChasmaDepth`, `uWrinkleAmp`, `uCryoRidgeAmp`,
  `uGlacialAmp`, `uLineationAmp`, `uSubAmp`, `uHexBorderDepth`, `uShatBorderDepth`,
  `uFluvialDepth`, `uOutflowDepth`, `uKarstDolineDepth`, `uKarstMazeDepth`,
  `uDeltaAmp`, `uEjectaAmp`, `uPolarAmp`, `uFacetAmp`, `uTalusAmp`, `uLobeAmp`,
  `uDuneAmp`, `uDustDepth`, `uFrostNoiseAmp`) is **already scaled by `reliefNorm`
  exactly once** — via `uPerturb` at `perturbAnalytic`. They are NOT un-normalized;
  they are single-normalized through the universal path.

**What CHANGES (the corrected S1 strategy):** the envelope must ride **exactly once
via `uPerturb`** (the universal carrier), and the three squaring families must
**drop `reliefNorm` from their own amp**. **Raw families are NOT newly wired** —
wiring `reliefEnvelope` onto a raw amp would ADD a second factor on top of the
`uPerturb` pass ⇒ a fresh `envelope²` double-dip, the exact opposite of the fix.
This satisfies the audit's "radius visibly expressed in ALL height-bearing families"
promise **through the single universal `uPerturb` envelope**, not through a
per-family sweep. **Reference-body invariance:** at Earth (`RE=1, g=1`)
`reliefNorm=1` and `reliefEnvelope=1`, so both the `uPerturb` swap and the
per-family `reliefNorm` removal are **no-ops at the reference** (byte-safe there);
only non-reference draws change (the squaring is removed off-reference).

### 0.3 The crater depth law (`craterAmplitude`) — EXISTS, live, inverted

**Seam:** `src/worldengine/base/bombardment.js` →
`craterAmplitude(D) = CRATER_DEPTH_N · (D/D_REF_RAD)^DEPTH_POW`
with `CRATER_DEPTH_N=0.18`, `D_REF_RAD=0.50`, `DEPTH_POW=0.5`.
⇒ `d/D = A/δ = 0.2546·δ^-0.5` (reproduced in `calibration/crater-depth-law.mjs`:
0.36 at δ=D_REF, **1.085 at the mesh floor** — near-hemispherical, inverted).

**Consumers of the amplitude (all in `bombardment.js`):** `craterProfile(s, D)`
and `relaxedCraterProfile(s, D, epsBowl, epsRim)` both open with
`const A = craterAmplitude(D)`; the stamp loop `writeBombardment` →
`forEachCrater(condition, macroSeed, N, cb)` yields `(centre, delta, tI, D_km)`
per stamped crater and calls `relaxedCraterProfile`. **`D_km` and the condition
(hence `g`) are in scope at stamp time** — the complex-transition branch has the
data it needs without a new draw.

**Import scope (blast radius) — proven by grep:** `bombardment.js`'s
`craterAmplitude`/`craterProfile` are imported ONLY by the three bombardment
test files (`worldengine-v2-5-bombardment`, `-v2-6-craters`, `-v2-6-ice`);
`planet-lod-rivers.js` imports only `writeBombardment`/`craterSchedule` (not the
amplitude). The **legacy F2/F3 in-shader crater synth is a SEPARATE code path** —
`planet-lod-lab-core.js` `craterProfile(r, opts)`, `src/objects/Moon.js` GLSL
`craterProfile(f1, craterRadius)`, `planet-lod-height.glsl.js` F2 transcription —
none import from `bombardment.js`. **This increment does not touch the legacy
synth** (intent non-goal; matches v2-6 BUILD-NOTES).

**What CHANGES:** `craterAmplitude` becomes `craterAmplitude(δ, D_km, g)` — simple
regime `d/D=0.20` constant (angular-only fallback keeps the current single-arg
call working), complex roll-off above `D_t(g)` (§2). `craterProfile`/
`relaxedCraterProfile` gain the optional `(D_km, g)` pass-through. `writeBombardment`
passes the yielded `D_km` + `condition.surfaceGravity`. **Writes only
`craterField` (unhashed) — byte-inert against the 75-golden** (the writer's own
header states this; §5).

### 0.4 The carrier relief families do NOT double-dip — EXISTS, already correct

**Critical fence finding.** The carrier writers that bake displacement into
`carrier.height` (**hashed → golden**) apply a gravity cap but **no explicit
`1/R`**. The **complete** set (lens mechanism MF3 — the pre-lens list of three was
incomplete; the AC-0 "ALL families" deliverable requires the full grep):

- `src/worldengine/base/tectonic.js` → `writeHeightSphere`/`runE6`:
  `baseAmp = 0.6 · gCap · (0.3 + 0.7·silicate)`, `gCap = reliefGravityFactor(g)`
  — a **private local copy** (L167). Reads `g` only.
- `src/worldengine/base/magmatism.js`: its own `gFactor` (gFactor = 1 at reference
  gravity → byte-safe).
- `src/worldengine/base/relief-e6-tectonic.js`: local `reliefGravityFactor(g)` (L67).
- `src/worldengine/base/plates.js`: `gFactor = clamp((g/g0)^-0.5, 0.4, 2.5)` on
  `UPLIFT_GAIN`/`RIFT_GAIN` (L137–139) → `carrier.height.set(U)` (L366). g only.
- `src/worldengine/base/shellRelief.js`: `gFactor = clamp((g/REF)^-0.5, 0.4, 2.5)`
  on `RIDGE_AMP`/`CHAOS_AMP`/`CHAOS_BASE` (L144–147). g only.
- `src/worldengine/base/stagnantLid.js`: `gFactor = clamp((g/REF)^-K_G, 0.5, 2.0)`
  with **`K_G=0` ⇒ gFactor≡1** (gravity scaling deliberately DEFERRED, L119/144)
  → `carrier.height.set(U)` (L452). No live g-factor.
- `src/worldengine/base/mixedInterior.js`: the composer, `carrier.height.set(U)`
  (L396) — composes the above, adds no new radius/g factor.

**Consequence (write-side):** the footnote-14 *write-side* double-dip exists in
**none** of the carriers (all g-only, no `1/R`) — so **no carrier edit, no golden
re-capture**. The Derivation Note documents all seven by grep; it does not change them.

**BUT — the bake-seam composite the write-side view cannot see (lens physics MF3 +
mechanism MF3, source-verified).** The lab runs `reliefBakeStrength = 1.0` **live
by default** (`planet-lod-lab.html:2535` "LAB live initial = ON"). In that branch
`hd = baked` (the baked carrier: `height + shelfDepth + craterField`, L377–381),
`grad = hd.yzw`, and the whole baked gradient is then scaled by
`reliefAmp = uPerturb·mix` at `perturbAnalytic` (§0.2 Path B). So at the live default
the baked carrier relief — which already carries its **write-time `gCap` (`g^-0.5`)**
— is multiplied **again** by the `uPerturb` envelope (`g^-0.58`): a **composed
`g^-1.08`** on carrier relief at the shading stage. This is a *render-side*
composition of two g-signals for the same strength-limited-relief effect. It is
**resolved by the §0.2 single-carrier rule** (envelope rides once via `uPerturb`)
plus the Derivation-Note composite row (§1.2): both `gCap` and the envelope are
**clamped** (`[0.4,2.5]` × `[0.40,~55]`), so the composed apparent is bounded, and
the **live AC-LAB-READ is the real in-band gate** (the linear model does not see
this path — §2.1). Carrier bytes are still untouched (this is all render-side).

### 0.5 The composite/bake seam — EXISTS

`planet-lod-rivers.js` → `compositeMargins(carrier)` returns
`height + shelfDepth + craterField` (raw sum) → baked into `uReliefBakeCube`;
render branches on `uReliefBakeStrength` between baked-carrier and in-shader synth.

**CORRECTION (lens physics MF3, source-verified).** The pre-lens claim that
`craterField` "flows through **unmultiplied by `reliefNorm`**" is **false at the
live render.** `uReliefBakeStrength` is **1.0 by default in the lab**
(`planet-lod-lab.html:2535`), and the UAT scenario renders through the baked branch,
where the baked composite (including `craterField`) **is** scaled by
`uPerturb·mix` at `perturbAnalytic` (§0.2 Path B / §0.4 bake-seam). The `raw sum`
is only true of the *carrier byte* (`compositeMargins`), NOT of the *rendered
apparent*. Implication for AC-DEPTHLAW: **`d/D = 0.20` is a CARRIER-space ratio**
(the byte-level crater depth the depth-law fix pins at source, §0.3); the RENDERED
apparent crater relief is that carrier depth × the bounded `uPerturb` envelope
(like all other relief) — in-band because the envelope is capped, verified live by
AC-LAB-READ. The depth-law fix (§0.3) still correctly targets the carrier
`craterField` at source; the bake carries the correct carrier d/D, and the render
scales it once through the same universal envelope.

---

## (1) THE DERIVATION NOTE — radius/gravity exponents across height families

> **This note ships in the plan and is the sizing reference for Inc-4 (figure
> render) and Inc-5 (angular widths).** It resolves contract designDecision 3 /
> audit footnote 14: *post-v2-6, `deriveConditionVector` sets
> `surfaceGravity = g_c·(R/R_c)`, so g is monotonic in the drawn R at fixed
> composition. Any `g^-q` factor already carries the radius signal. No family may
> apply BOTH an explicit `rF`/`1/R` factor AND a g-derived factor for the same
> physical effect.*

### 1.1 The governing rule (one sentence)

**Express radius through g, once.** A height-bearing family picks **exactly one**
radius channel: either an explicit `radiusEarth` term **or** a `g`-derived term —
never both — because `g` is now a function of `R`. The single-signal principle is
the governing rule; **the shipped exponent is anchor-fit, not `1/g²`-derived**
(lens physics MINOR-5): a naive strength-limited scaling `h_max/R ∝ 1/g²` at fixed
density is physically the wrong magnitude here (it would put Mimas ~2.4e4× Earth —
absurd), so `Q_RELIEF=0.58` is a **least-squares fit through the real-body
relief/R anchors** (§2.1), NOT a closed-form `1/g²`. Keep the single-application
discipline; do not present `1/g²` as the derivation of the shipped exponent.

### 1.2 Exponent ledger (every height-bearing family) — CORRECTED post-lens

> **Governing resolution (lens mechanism MF1):** the envelope rides **once, on
> `uPerturb`** — the universal `perturbAnalytic` strength that scales every family's
> `grad` (§0.2 Path B). The three families that ALSO carry `reliefNorm` in their own
> amp (`uMountainAmp`/`uCraterAmp`/`uEcuCanyonDepth`) and the radius half of
> `uEdificeAmp` **drop that factor** so they stop squaring. **No raw family is newly
> wired** — each is already single-normalized via `uPerturb`.

| Family / seam | radius channel today | issue | resolution |
|---|---|---|---|
| **`uPerturb`** (universal envelope carrier) | explicit `1/RE` **×** `g^-0.5` in `reliefNorm` | **the convicted defect** (uncapped `1/RE`) | **drop `1/RE`**; `uPerturb = state.perturb · reliefEnvelope(RE,g)`, `reliefEnvelope=clamp(g^-Q_RELIEF, FLOOR, CEIL)`, `Q_RELIEF≈0.58` (§2). Radius via g, once. This is the ONE envelope application. |
| `uMountainAmp`, `uCraterAmp`, `uEcuCanyonDepth` | own amp × `reliefNorm`, **then × `uPerturb`** ⇒ `reliefNorm²` | **double-application** (mechanism MF1) | **remove `reliefNorm` from the amp** (leave state amp × existing gates); the envelope reaches them once via `uPerturb`. Byte-safe at Earth (`reliefNorm=1`). |
| `uEdificeAmp` | `(1/RE)` (g=1 passed) **× `uPerturb`** ⇒ `(1/RE)²` radius | double-application + unimplementable pre-lens instruction (byte-fence MF2 + physics MF2) | **drop the `(1/RE)`** entirely. Edifice radius flows via **two DISTINCT laws, each once**: the global `uPerturb` envelope (`g^-0.58`, bulk strength cap) × the edifice-specific `uEdificeMaxHeight = clamp(1/g,0.2,2.0)` (core L739, volcano-buoyancy ∝1/g — Olympus Mons). **Composed edifice g-exponent = `g^-1.58`, ACCEPTED as a distinct-effect composition** (strength-cap × volcano-buoyancy — like count∝R² vs size∝1/R for craters), NOT the footnote-14 same-effect `1/R×g^-q`. Recorded here as an intentional edifice-amplitude behavior change. |
| **carrier height** (`tectonic`, `magmatism`, `relief-e6-tectonic`, `plates`, `shellRelief`, `stagnantLid`, `mixedInterior`) | `gCap`≈`g^-0.5` only (stagnantLid `K_G=0`⇒≡1), **no `1/R`** | write-side clean | **document all seven, do not edit** (golden-baked; §0.4). |
| **bake seam** (baked carrier × `uPerturb`, live `reliefBakeStrength=1`) | carrier `gCap`(`g^-0.5`) **× envelope**(`g^-0.58`) ⇒ composed **`g^-1.08`** | render-side composition of two g-signals for the same effect (physics MF3) | **accept-and-document, bounded**: both factors are clamped, so composed apparent is bounded; **live AC-LAB-READ is the in-band gate** (the linear model does not see this path, §2.1). Alternative if live reads hot: exclude the baked branch from the `uPerturb` multiply — a one-line S1 fallback, flagged. |
| Crater **depth** (`craterAmplitude`) | angular δ; g enters only at `D_t(g)` transition | none | new law reads g **once** (transition), δ for size (§2). Rendered apparent = carrier d/D × `uPerturb` envelope (bounded). |
| Crater **count/size** (`craterSchedule`) | `R²` (count), `radPerKm∝1/R` (size), `g^-K_GS` (size) | none (distinct laws) | **untouched** — separate physical laws, not a relief double-dip. |
| **atmo / albedo — NOT relief** (`uPolarAmp` F29 polar-vortex polygon MEANDER, `planet-lod-height.glsl.js:1757`) | none (raw) | **misclassified pre-lens** (mechanism MF2) | **OUT of the km-relief family AND atmo-lane fenced** — F29 is "ALBEDO/LUMINANCE ONLY" (glsl L389), assigned inside the F27–F30 storm block (`planet-lod-lab.html:5804`). **Do NOT wire; do NOT touch** (lane fence). |
| **Crystal — deferred wholesale** (`uFacetAmp` F43 crystalline facet relief, glsl L515/L2528) | none (raw) | out of scope (mechanism MF4) | **OUT** — Crystal/exotics deferred wholesale (intent non-goal, Max ruling 2026-07-21). Do NOT wire. |
| **Ejecta — fenced channel** (`uEjectaAmp`, glsl L2017 `uEjectaStrength·uEjectaAmp`) | none (raw) | fenced (mechanism MF5) | **OUT** — ejecta is fenced pending Max's product call (intent non-goal / audit Q1). Do NOT wire until the fence is resolved. |
| micro-texture (`uDuneAmp`, `uDustDepth`, `uFrostNoiseAmp`, `uTalusAmp`, `uLobeAmp`) | none (raw) | n/a | **out of the km-relief family** — surface textures, not km-authored relief. Already single-normalized via `uPerturb`; do NOT add a second factor. |
| raw macro-relief pass-throughs (`uChasmaDepth`, `uWrinkleAmp`, `uHexBorderDepth`, `uShatBorderDepth`, `uCryoRidgeAmp`, `uGlacialAmp`, `uLineationAmp`, `uSubAmp`, `uFluvialDepth`, `uOutflowDepth`, `uKarstDolineDepth`, `uKarstMazeDepth`, `uDeltaAmp`) | none (raw) | n/a | **already enveloped once via `uPerturb`** (§0.2 Path B). **Do NOT wire** — a per-amp `reliefEnvelope` would make them `envelope²`. Document as single-normalized-through-`uPerturb`. |

**Sign discipline (all families):** lower g ⇒ higher relief/R (correct, kept).
**Magnitude discipline:** `reliefEnvelope=clamp(g^-0.58, 0.40, 133)`; the `133` CEIL
**never binds** — the internal `max(g,1e-3)` g-floor caps the multiplier at
`(1e-3)^-0.58 ≈ 55` (lens physics MINOR-4), so the "apparent ≤ 0.40 at any
degenerate draw" guarantee is delivered by the **g-floor**, not the CEIL. `RELIEF_FLOOR
= 0.40` is **inherited** from the current `gCap` floor (lens physics MINOR-6), not
anchor-derived (no fit body exercises it; it binds only above g≈4.85). See §2.1 for
the CEIL/FLOOR follow-up.

---

## (2) CALIBRATION-FIRST — the derived laws (committed, runnable, reproduce)

Two STEP-0 pre-checks, v2-5/v2-6 pattern (pure `node`, no dev server, no
`claude -p`), committed with this plan. **Re-run to reproduce every number.**

### 2.1 `calibration/relief-envelope.mjs` — the envelope law

Derives the strength-cap replacement for the uncapped `1/RE`:

```
reliefEnvelope(R, g) = clamp( g^-Q_RELIEF , RELIEF_FLOOR , RELIEF_CEIL )
Q_RELIEF   = 0.58   (least-squares through the distributed-relief anchors, forced Earth=1)
RELIEF_FLOOR = 0.40 (INHERITED from the gCap floor — not anchor-derived; binds only g≳4.85)
RELIEF_CEIL  = 133  (never binds — the g-floor caps the multiplier at (1e-3)^-0.58 ≈ 55)
```

**THE EXACT, DEFENSIBLE CLAIM is the MULTIPLIER LAW** (this is what the lab bakes):
the uncapped `1/RE` (7.00× at the worked point, →∞ as R→0) is replaced by the
bounded `g^-0.58` envelope. Worked case **collapses 7.00× → 2.09×** (3.35×
reduction); the multiplier is monotone in g (sign preserved) and bounded ≤ ~55
(≤ the Phobos multiplier), so **no draw exceeds the most-extreme real body**. That
is exact and is the AC-ENVELOPE quantitative gate.

> **Lens physics MF1 — the apparent/band table below is ILLUSTRATIVE ONLY, not a
> render proof.** The model `apparent = REF_RELIEF · multiplier` with
> `REF_RELIEF=0.003` **cannot reproduce the convicting number**: it prints the OLD
> worked apparent as `0.003·7.0 = 0.021`, which sits INSIDE the WORKED band
> `[0.003,0.05]` — i.e. under this model the *defective* law was already "in band,"
> so the model cannot detect the molten defect it is calibrated to fix (the
> math-check's `0.70` comes from `uPerturb=state.perturb·reliefNorm=3.85` through
> the shader's normal-saturation + the §0.2 squared-family path, a chain the linear
> model does not capture). Therefore: the band table is a first-order **sizing aid**
> to show the anchors are *ordered* sensibly; the **LIVE AC-LAB-READ metric is the
> SOLE apparent gate**. Do not present "worked case lands in band" as evidence the
> render is fixed — present the exact multiplier collapse + the live metric.

Anchor roles: **distributed-relief bodies** (Earth, Mercury, Mars, Moon, Mimas) are
fit; **basin-dominated extremes** (Phobos=Stickney, Vesta=Rheasilvia — a *single*
giant crater, a bombardment effect, not a strength envelope) are the **ceiling
reference** (assert multiplier ≤ Phobos), reported not fit. Reproduces:

| body | old× | new× | apparent (illustrative) | band | note |
|---|---|---|---|---|---|
| Earth | 1.00 | 1.00 | 0.0030 | [0.002,0.01] | fit |
| Mercury | 4.25 | 1.76 | 0.0053 | [0.003,0.01] | fit |
| Mars | 3.05 | 1.76 | 0.0053 | [0.003,0.02] | fit |
| Moon | 9.02 | 2.84 | 0.0085 | [0.008,0.05] | fit |
| Mimas | 80.4 | 18.6 | 0.0558 | [0.04,0.15] | fit |
| Vesta | 60.7 | 8.40 | 0.0252 | [0.05,0.4] | CEIL-REF (passes ≤0.40; **under its band floor** — see below) |
| Phobos | 1437 | 55.0 | 0.1649 | [0.15,0.4] | CEIL-REF (≤0.40) |
| **WORKED (0.27,0.28)** | **7.00** | **2.09** | **0.0063** | [0.003,0.05] | worked point |

**Vesta under-band (lens mechanism MINOR-7):** the illustrative apparent 0.0252 sits
**below** Vesta's band floor 0.05 (real Vesta relief ~0.15, so ~6× under); it passes
only because Vesta is gated as a ceiling-reference (≤0.40), not on band membership.
This is consistent with the basin-dominated-extreme rationale (Rheasilvia is a single
impact, `bombardment.js`'s job, not the strength envelope), but **record it in
BUILD-NOTES** so "small bodies SHOULD read lumpy" is not silently under-served at the
Vesta anchor. **CEIL/FLOOR follow-up:** either resize `RELIEF_CEIL` to ~55 where it
can actually act (or relabel it a documentation constant), and label `RELIEF_FLOOR`
inherited — both are non-blocking calibration hygiene, flagged not silent.

### 2.2 `calibration/crater-depth-law.mjs` — the depth-law constants

```
SIMPLE  : d/D = 0.20 constant  ⇒  CRATER_DEPTH_N: 0.18→0.10 , DEPTH_POW: 0.5→1.0
          (A(δ)=0.20·δ; A(D_REF_RAD)=0.10 ≥ MIN_BASIN_DEPTH_N 0.08 — legibility kept)
TRANSITION: D_t(g) = K_DT/g km , K_DT=3.1 (LS on Earth 3.5 / Mercury 10 / Moon 18 km)
COMPLEX : d/D = 0.20·(D_t/D)^P_COMPLEX for D>D_t , P_COMPLEX=0.66
          (Pike d∝D^0.3 ⇒ P≈0.7; anchored on SPA d/D=0.008)
```

Verified (reproduces): OLD d/D 0.36→1.085 across the rendered range (inverted,
hemispherical at the floor); NEW d/D **0.068→0.015** monotonically non-increasing,
**max 0.068 ≤ 0.25**, simple-regime basin legible. A tiny low-g body (g=0.0065)
gets `D_t=477 km` ⇒ its rendered craters stay **simple bowls (d/D=0.20)** — the
Mimas/Vesta lumpy-but-cratered read, not molten. **Known residual (fix-or-accept,
flagged):** Copernicus cross-check reads 0.070 vs literature 0.040 (single-anchor
SPA fit slightly under-shallows the mid-complex range) — the shape and extremes
are right; metrological tightening is deferred, not silent.

---

## (3) SLICE SPECS

### S1 — envelope law + single-carrier rewire + derivation note (render-side, AC-ENVELOPE, AC-0)

> **Strategy (post-lens, §0.2/§1.2):** envelope rides ONCE on `uPerturb`; the three
> squaring families + edifice DROP `reliefNorm`; NO raw family is wired. Byte-safe at
> Earth (envelope=1, reliefNorm=1 ⇒ all edits are no-ops at the reference draw).

1. **Add** `planet-lod-lab-core.js` → `export function reliefEnvelope(radiusEarth, surfaceGravity)`
   = `clamp(g^-Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL)` with the §2.1 constants
   (export the constants too). `radiusEarth` is accepted for signature symmetry but
   **unused in the return** (radius flows via g). Do **not** edit
   `reliefGravityFactor` / `reliefAmplitudeFromKm` (shared, separately tested — §0.4).
2. **Rewire `uPerturb` (the ONE envelope application):** `planet-lod-lab.html:5608`
   `uniforms.uPerturb.value = state.perturb * reliefEnvelope(_RE, _gNow)` (was
   `· reliefNorm(state.mountainHeightKm, _RE, _gNow)`).
3. **Strip the double-application** from the three squaring families + edifice —
   **remove the `reliefNorm(...)` multiplier** from:
   `uMountainAmp` (:5969), `uCraterAmp` (:5959), `uEcuCanyonDepth` (:5922) — each
   keeps its own state amp × existing enable/exotic/relevance gates; and
   `uEdificeAmp` (:6002) — **drop the `· reliefNorm(state.edificeHeightKm, _RE, 1.0)`
   `(1/RE)` factor** (radius now via the `uPerturb` envelope + `uEdificeMaxHeight∝1/g`,
   §1.2 edifice row). Update the `uEdificeAmp` inline comment (the "g=1 avoids
   double-applying" note is now stale). **Do NOT wire any raw pass-through family**
   (they are already enveloped once via `uPerturb` — §0.2).
4. **Retire the now-unused `reliefNorm` function** (`planet-lod-lab.html` ~L1971) —
   after steps 2–3 nothing calls it (grep-confirm zero `reliefNorm(` consumers
   remain). **Update the stale comment block L1962–1970** (it documents the
   `(1/RE)·reliefGravityFactor(g)` law — false post-edit; lens byte-fence MINOR-5).
   **FENCE: do NOT touch the `mulberry32` function or its comment at L1985–1989** —
   that block is atmo-lane-adjacent and the token is source-pinned by
   `tests/worldengine-base-storm-e.test.js:396` `toContain('mulberry32')`; edit the
   relief block ONLY.
5. **Derivation Note** (§1) lands in BUILD-NOTES as the AC-0 named-consumer record:
   `reliefEnvelope → uPerturb` (the single universal carrier); the full seven-writer
   carrier grep-proof (§0.4, no `1/R`); the edifice composed-exponent (`g^-1.58`,
   distinct-effect) and bake-seam composed-exponent (`g^-1.08`, bounded) rows;
   the atmo/crystal/ejecta OUT classifications; taxonomy/drift guards green; no new
   `*Enabled` key.
6. **Unit tests** (new `tests/worldengine-inc3-relief-envelope.test.js`): anchors
   ordered/multiplier-bounded; worked-case multiplier collapse `7.0×→2.09×`; sign
   monotone; clamps behave (g-floor caps ≈55, CEIL inert); `reliefEnvelope` return
   is independent of `radiusEarth` (structural/spy assert — radius via g only).
   Cross-check exported constants against the calibration script. (The lab-side
   `uPerturb`/family strip is not unit-testable in `.html`; it is verified by the
   S3 population-sweep envelope gate + the live AC-LAB-READ.)

### S2 — depth law in bombardment.js + unit tests + fence harness (AC-DEPTHLAW, AC-FENCE)

1. **`craterAmplitude(δ, D_km, g)`** (`bombardment.js`): `A_simple = D_D_SIMPLE·δ`
   (`CRATER_DEPTH_N=0.10`, `DEPTH_POW=1.0`); when `D_km`+`g` supplied,
   `× shallow`, `shallow = D_km>D_t(g) ? (D_t/D_km)^P_COMPLEX : 1`, `D_t=K_DT/g`.
   Angular-only call (no `D_km`/`g`) ⇒ simple regime (preserves existing
   single-arg callers). Add `export const K_DT`, `P_COMPLEX`, `D_D_SIMPLE`.
2. **`craterProfile(s, D, D_km, g)`** and **`relaxedCraterProfile(s, D, epsBowl,
   epsRim, D_km, g)`**: pass `(D_km, g)` into the `craterAmplitude` call;
   defaults `undefined` ⇒ simple ⇒ **ε=0 bit-identity and angular-only callers
   unchanged**.
3. **`writeBombardment`/`forEachCrater`**: pass the yielded `D_km` +
   `condition.surfaceGravity` into the profile calls. `collectDiag` per-crater
   record adds `D_km` and stores `A` as the **actually-stamped** amplitude
   (`craterAmplitude(delta, D_km, g)`).
4. **Unit tests** (new `tests/worldengine-inc3-depth-law.test.js`): d/D=0.20
   (±0.02) flat across the simple regime; complex roll-off at 3 gravity anchors
   (Earth/Mercury/Moon `g`); **monotonicity property** (d/D non-increasing in D
   across a swept range); **no crater d/D > 0.25**; `D_t(g)` at the three anchors.
5. **AC-0 grep-token caution (lens byte-fence MINOR-4):** the v2-5 shadow-audit
   scans `bombardment.js` source — `computeE1`/`e1Regime` **including comments**,
   and `PRESET_ARCHETYPE`/`.label`/`archetype`/`geodynamicRegime` on
   comment-stripped code (`tests/worldengine-v2-5-bombardment.test.js:273–289`).
   New comments/constants for `D_t`/`P_COMPLEX`/`D_D_SIMPLE` **must avoid these
   tokens** (e.g. document the simple→complex transition without the word
   "archetype"). Grep the diff before commit.
6. **Apply the §4 test edits** — including the **two AC-DISTINCT L2 asserts**
   (`:253`, `:264`) the pre-lens §4 missed (lens byte-fence MF1): both collapse
   ~30–50× under the new (shallower) law and would fail `> 0.5`, growing the
   baseline by 2. See §4 for the fix (normalized/law-derived threshold + churn note).
7. **Fence harness** (§5) — the fixed-seed population-invariance proof (schema now
   carries pre-edit `craterField` exemplars — §5.2).

### S3 — population-sweep envelope gate + frozen-trace + BUILD-NOTES + evidence prep (AC-POPSWEEP, AC-FROZEN-TRACE)

1. **Extend the population harness** (copy v2-6 `population-sweep.mjs` into this
   dir's `calibration/`, or extend in place) with a **NEW envelope gate on the EXACT
   MULTIPLIER** (not the illustrative apparent — lens physics MF1): across ≥64 seeds
   × all archetype presets, assert `reliefEnvelope(R_drawn, g_drawn)` is **bounded
   ≤ the Phobos multiplier (~55) and monotone in g** (the exact, defensible
   invariant). The `·REF_RELIEF` apparent band may be reported as a **soft
   illustrative** signal only. Assert all existing gates (coverage, variance,
   E1-diversity, goldens) stay green (depth edits don't move coverage — §5). Run
   live; commit the summary JSON. **The in-band RENDER claim is the coordinator's
   live AC-LAB-READ, not this gate.**
2. **AC-FROZEN-TRACE** — `calibration/frozen-ice-trace.mjs`: compute
   `icenessOf(Frozen)` and `iceRelaxation(cond, D_km, tI, iceness)` `epsBowl/epsRim`
   at the Frozen preset's low-R/g worked point. **Predicted result (to be proven):
   ε≡0** — at T≈60 K the Arrhenius η is so large that `1−exp(−t/τ)===0` in float64
   (the writer's own cold-Frozen invariant), so ice relaxation contributes **zero**
   to the molten read; the Frozen defect is fully #1+#2, fixed here. **Decision:
   FILE for the ice/exogenic increment with the number** (not the same
   vertical-scale defect family). If the trace shows ε>1e-6 at any plausible Frozen
   draw, re-open as fix-here.
3. **BUILD-NOTES.md** — DOES/UNLOCKS card, AC-0 named-consumer table (the
   Derivation Note: `reliefEnvelope → uPerturb` single carrier; the seven-writer
   carrier grep; edifice `g^-1.58` + bake-seam `g^-1.08` composed-exponent rows;
   atmo/crystal/ejecta OUT), the two calibration records, the frozen-trace number,
   the Copernicus residual, **the Vesta under-band note** (illustrative apparent
   0.0252 < band floor 0.05, passes as CEIL-REF — lens mechanism MINOR-7), **the
   CEIL-never-binds / FLOOR-inherited calibration-hygiene note** (lens physics
   MINOR-4/6), the apparent-model-is-illustrative caveat (lens physics MF1),
   deviations, suite baseline at the seam.
4. **Named-file staging discipline (lens byte-fence MINOR-6 + workstream hard
   rule):** the repo root carries ~30 untracked PNGs and the NOT-OURS modified
   `src/auto/CameraChoreographer.js` + `src/debug/LabMode.js`. **Stage NAMED files
   only — never `git add -A`/`git add .`.** No root PNG and neither NOT-OURS file
   may ride along on any commit (plan, calibration, source, tests, or evidence).
5. **Evidence prep** for the coordinator's later live AC-LAB-READ / AC-UAT drive:
   the paired same-worldSeed protocol + the stated metric (rim-arc contrast /
   surface-normal distribution) — spec only; **no browser work here** (coordinator's).
   Any screenshots the coordinator later commits go to `evidence/` as named files
   (per step 4).

---

## (4) TEST-EDIT ENUMERATION

**Principle:** calibration constants are NOT golden-fixture material; **no golden
re-capture** anywhere. Depth constants are pinned by *behavioral* asserts — most
survive, but **two AMPLITUDE-scaled asserts do NOT** and were missed pre-lens
(byte-fence MF1): the new law makes Moon-fixture craters ~30–40× shallower (every
stamped crater is complex-shallowed, `D_floor ≫ D_t`), which collapses the
AC-DISTINCT field-`L2` metrics ~30–50×.

| File | Location | Current | Edit |
|---|---|---|---|
| `tests/worldengine-v2-6-craters.test.js` | clean-floor exactness, `expect(cr.floorValuePreClamp).toBe(Math.fround(-craterAmplitude(cr.delta)))` (~L147) | oracle recomputes amplitude angular-only | **EDIT** → compare to the diag's actually-stamped amplitude: `Math.fround(-cr.A)` (diag now stores `A = craterAmplitude(delta, D_km, g)`). Necessary because the writer stamps the complex amplitude. |
| **`tests/worldengine-v2-5-bombardment.test.js`** | **AC-DISTINCT inter-seed `expect(Math.sqrt(l2)).toBeGreaterThan(0.5)` (L253)** | threshold set for OLD amplitudes (min L2 ≈ 2.68) | **EDIT (lens byte-fence MF1)** — under the new law min inter-seed L2 collapses to ≈0.075 ⇒ `> 0.5` FAILS. Replace with an **amplitude-invariant relative metric** (L2 normalized by field RMS, ≫ the exact-0 repeat floor) **or** a law-derived absolute threshold sized from the new amplitude scale. Add the **churn-justification comment** (file hard-fence rule 9). Intent preserved: distinct seeds ⇒ distinct populations. |
| **`tests/worldengine-v2-5-bombardment.test.js`** | **AC-DISTINCT (g,age)-grid `expect(Math.sqrt(l2)).toBeGreaterThan(0.5)` (L264)** | threshold set for OLD amplitudes (min L2 ≈ 1.20) | **EDIT (lens byte-fence MF1)** — new min ≈0.023 ⇒ `> 0.5` FAILS. Same fix + churn note as L253. |
| `tests/worldengine-v2-5-bombardment.test.js` | `expect(craterAmplitude(D_REF_RAD)).toBeGreaterThanOrEqual(MIN_BASIN_DEPTH_N)` (~L121) | 0.18 ≥ 0.08 | **NO EDIT** — new simple A(D_REF)=0.10 ≥ 0.08 still holds (angular-only ⇒ simple regime). Review-confirm only. |
| `tests/worldengine-v2-5-bombardment.test.js` | `craterProfile` two-signed (~L111–118) | angular-only | **NO EDIT** — shape unchanged; passes. |
| `tests/worldengine-v2-6-ice.test.js` | ε=0 bit-identity `relaxedCraterProfile(s,D,0,0)===craterProfile(s,D)` (~L57); dome test (~L81–85) | angular-only | **NO EDIT** — both default to the simple branch; identity holds. Verify after the signature change. |
| Import lines (`D_REF_RAD`, `MIN_BASIN_DEPTH_N`, `MESH_FLOOR_RAD`) | v2-5 test L33 | — | **NO EDIT** — those exports are kept. |
| `CRATER_DEPTH_N` / `DEPTH_POW` literal pins | — | none exist (grep: only `bombardment.js` + this doc) | **NONE** — no test pins these constants, so retuning them breaks no assertion. |

**Blast-radius enumeration (lens mechanism MINOR-6):** the EDITED symbols
`craterAmplitude`/`craterProfile` are imported ONLY by the three bombardment test
files. Note for completeness that `tests/worldengine-v2-6-crystal.test.js:29`
imports `craterSchedule` from `bombardment.js` — but `craterSchedule` is
**untouched** by this increment (population/draw stream is amplitude-free), so it is
not in the edit blast radius.

**New test files (added, not edited):** `tests/worldengine-inc3-relief-envelope.test.js`
(S1), `tests/worldengine-inc3-depth-law.test.js` (S2). These do NOT grow the
4-failure baseline (new files, all-green).

---

## (5) FENCE PROOF strategy (AC-FENCE)

**Claim to prove:** carrier bytes untouched; goldens pass with NO re-capture; at
fixed `worldSeed` the crater **population** (count, centers, diameters, coverage)
is exactly invariant pre/post — only depth/profile amplitudes change; full suite
stays at the 4-failure baseline.

1. **Carrier / golden byte-identity (structural + empirical).**
   - *Structural:* the envelope edits live in `planet-lod-lab-core.js`
     (`reliefEnvelope`, new) + `planet-lod-lab.html` (render-side uniforms) —
     **no `src/worldengine/**` carrier writer is touched for relief.**
     `bombardment.js` writes only `craterField` (unhashed) — its own header +
     the v2-5 test (`craterField !== height/shelfDepth/maturity`) prove the
     channel separation.
   - *Empirical:* run `npx vitest run tests/v2-0-byte-identity.test.js`
     **from the repo dir** → green, **no re-capture**. (Also spawned as a
     `population-sweep.mjs` gate at the same commit.)

2. **Population invariance (the depth edit cannot move the draw) — two-part.**
   - *Structural guard (unit test):* `craterSchedule` and `forEachCrater` bodies
     contain **no `craterAmplitude` reference** (grep assert) — the draw stream
     (`u_centre→u_size→u_age`, `D_km` via `drawBoundedPareto`, `tI` via
     `chronInverse`) is computed **before** any amplitude call. By construction,
     retuning `craterAmplitude` cannot move centre/D_km/tI/count.
   - *Empirical golden-tuple diff:* `calibration/fence-population-invariance.mjs`
     — at a fixed `worldSeed` (+ a fixed impact-surface condition), run
     `forEachCrater`/`writeBombardment collectDiag` and emit the sorted
     `{centre, D_km, tI}` tuples + `nStamp` + `craterSchedule.coverage` to a
     committed baseline JSON **captured at the S1 commit (pre depth edit)**; the
     S2 test re-runs and asserts **byte-for-byte identical tuples/count/coverage**,
     with **only `craterField` amplitude values differing**.
     **Schema (lens byte-fence MINOR-3):** the baseline JSON MUST also carry the
     pre-edit `craterField` reference — either a full-array hash **plus** a handful
     of exemplar `{index, value}` pairs, or the exemplar values alone — so the S2
     "amplitudes DID change" assert (`∃ i where cf_pre[i] ≠ cf_post[i]` while the
     tuple set is unchanged) has a committed pre-edit reference to diff against
     (the tuples alone do not carry the old amplitudes).

3. **Baseline not grown.** Full `npx vitest run` **from the repo dir** = **4
   known failures** (KnownObjects ×3, GalacticFeatures ×1) + vendor/motion-test-kit
   collection noise — never "fixed," never grown. The two new test files are
   all-green additions.

---

## Risks I could not fully resolve (surfaced, not buried)

1. **The linear apparent-model is not just first-order — it cannot reproduce the
   convicting number (lens physics MF1, folded).** With `REF_RELIEF=0.003` the
   model prints the OLD worked apparent as 0.021 (in-band), so it cannot detect the
   molten defect; the real chain is `uPerturb=state.perturb·reliefNorm=3.85` →
   shader normal-saturation → §0.2 squared-family path. **Resolution (folded, §2.1):**
   the EXACT multiplier collapse (7.0×→2.09×, bounded ≤~55) is the AC-ENVELOPE
   quantitative gate; the apparent/band table is illustrative sizing only; the **live
   AC-LAB-READ metric is the SOLE apparent gate.** Residual: if the live render reads
   hot, `Q_RELIEF` is a one-constant retune (no carrier); the bake-seam `g^-1.08`
   fallback (exclude the baked branch from `uPerturb`) is the escalation.
2. **Single-carrier rewire is byte-safe at the reference but changes off-reference
   relative balance (folded from the pre-lens "wire ALL families" risk).** Removing
   `reliefNorm` from `uMountainAmp`/`uCraterAmp`/`uEcuCanyonDepth`/`uEdificeAmp` is a
   no-op at Earth (`reliefNorm=1`) and removes the `reliefNorm²` squaring off-reference
   (§0.2). It is NOT unit-testable in `.html`; verified by the S3 population-sweep
   multiplier gate + the coordinator's live AC-LAB-READ. No raw family is wired, so
   the pre-lens over-wiring risk (treating `uDuneAmp`/atmo/crystal/ejecta as relief)
   is dissolved by construction.
3. **Depth-law mid-complex residual (Copernicus 0.070 vs 0.040).** The single-SPA-
   anchor fit under-shallows the mid-complex range by ~1.7×. Shape/extremes/
   monotonicity are correct and the render goal (kill the inversion + hemispherical
   pits) is met; tightening `P_COMPLEX` against a second anchor is deferred, flagged
   in BUILD-NOTES, not silent.
4. **`D_t(g)` uncapped for tiny bodies is intentional but untested live.** On a
   sub-Mimas draw `D_t` exceeds the body radius, so every rendered crater stays a
   simple d/D=0.20 bowl — physically the correct "bowl-covered small world" read,
   but only asserted in calibration, not yet seen live (coordinator's AC-LAB-READ).

---

## Lens log — adversarial review fold (2026-07-21)

Three adversarial lenses (byte-fence, physics, mechanism) reviewed the pre-lens
plan. Every must-fix was **source-verified against the actual code before folding**
(files/lines cited below). **No lens finding was rejected** — all held on
verification. Verdicts folded:

### Must-fixes (all CONFIRMED against source, all folded)

- **MF-A — double-application via `uPerturb` [mechanism MF1].** Verified:
  `perturbAnalytic(N, grad, reliefAmp)` with `reliefAmp = uPerturb·mix`
  (`planet-lod-lab.html:536–537`), `perturbed = normalize(N − gTan·strength·0.6)`
  (`planet-lod-height.glsl.js:1482`) scales the WHOLE `grad`; `uMountainAmp` (:5969)
  / `uCraterAmp` (:5959) / `uEcuCanyonDepth` (:5922) each also carry `reliefNorm` and
  add to `grad` (glsl 1479/1968/2781) ⇒ `reliefNorm²`. **Fold:** §0.2 rewritten
  (two-path model); §1.2 ledger rewritten (envelope once via `uPerturb`, strip the
  three families, do NOT wire raw families); S1 rewritten. This was the largest
  structural correction — the pre-lens "wire more families" strategy would have
  squared the raw families.
- **MF-B — `uEdificeAmp` row self-contradictory/unimplementable [byte-fence MF2 +
  physics MF2].** Verified: `reliefEnvelope` is g-only ⇒ `reliefEnvelope(RE,1.0)=1`
  (no-op deleting the `(1/RE)`); `_gNow` would stack `g^-0.58` on
  `edificeMaxHeight=clamp(1/g,0.2,2.0)` (core L739). **Fold:** §1.2 edifice row —
  drop `(1/RE)`, composed `g^-1.58` accepted as distinct-effect (strength-cap ×
  volcano-buoyancy); S1 step 3.
- **MF-C — bake-seam composite path [physics MF3 + mechanism MF3].** Verified:
  `reliefBakeStrength=1.0` live (`:2535`), `hd=baked` (:377–381) → scaled by
  `uPerturb`; carrier `gCap`(`g^-0.5`) × envelope(`g^-0.58`) = `g^-1.08`. §0.5's
  "unmultiplied by reliefNorm" was FALSE. **Fold:** §0.5 corrected; §0.4 + §1.2
  bake-seam row added (bounded, live-gated).
- **MF-D — `REF_RELIEF` inconsistent with the convicting 0.70 [physics MF1].**
  Verified by running `relief-envelope.mjs`: prints old-worked apparent `0.021`
  (∈ WORKED band) while captioned "from 0.70 molten." **Fold:** §2.1 reframed —
  exact multiplier is the gate, apparent/band table demoted to illustrative, live
  AC-LAB-READ the sole apparent gate; S3 step 1 gate changed to the exact multiplier.
- **MF-E — `uPolarAmp` misclassified [mechanism MF2].** Verified: F29 polar-vortex
  MEANDER, "ALBEDO/LUMINANCE ONLY" (glsl L389/1757), atmo block (lab.html :5804).
  **Fold:** §1.2 — reclassified OUT (atmo-lane fenced, do not touch).
- **MF-F — ledger omits four carrier writers [mechanism MF3].** Verified: `plates.js`
  (L137–139/366), `shellRelief.js` (L144–147), `stagnantLid.js` (K_G=0, L119/452),
  `mixedInterior.js` (L396) all write hashed `carrier.height`, all g-only. **Fold:**
  §0.4 seven-writer list; §1.2 carrier row. (Conclusion unchanged: no carrier `1/R`.)
- **MF-G — §4 omits the AC-DISTINCT L2 asserts [byte-fence MF1].** Verified:
  `tests/worldengine-v2-5-bombardment.test.js:253` + `:264` are both
  `expect(Math.sqrt(l2)).toBeGreaterThan(0.5)`; `crater-depth-law.mjs` confirms
  ~32× amplitude collapse at the Moon fixture (all craters complex-shallowed) ⇒
  both fail ⇒ baseline +2. **Fold:** §4 two EDIT rows (normalized/law-derived
  threshold + churn note); S2 step 6.

### Minors folded

- byte-fence MINOR-3 → §5.2 baseline schema now carries pre-edit `craterField`
  exemplars/hash.
- byte-fence MINOR-4 → S2 step 5 AC-0 grep-token caution (avoid `archetype` etc. in
  new bombardment.js comments; verified test at :273–289).
- byte-fence MINOR-5 → S1 step 4 updates stale comment L1962–1970; FENCE: do not
  touch the `mulberry32` block L1985–1989 (source-pinned by
  `worldengine-base-storm-e.test.js:396`).
- byte-fence MINOR-6 → S3 step 4 named-file staging (verified `git status`: ~30 root
  PNGs + NOT-OURS `CameraChoreographer.js`/`LabMode.js` modified).
- physics MINOR-4 → §1.2/§2.1: CEIL=133 never binds (g-floor caps ≈55); guarantee is
  the g-floor's.
- physics MINOR-5 → §1.1: exponent is anchor-fit, not `1/g²`-derived.
- physics MINOR-6 → §2.1: `RELIEF_FLOOR=0.40` labelled inherited.
- mechanism MINOR-6 → §4: `v2-6-crystal.test.js:29` imports `craterSchedule`
  (untouched) — enumeration completed.
- mechanism MINOR-7 → §2.1 + S3: Vesta apparent 0.0252 < band floor 0.05 (passes as
  CEIL-REF), recorded in BUILD-NOTES.

### Rejected: none.
All checked lens claims held against source. One nuance recorded, not a rejection:
the mechanism lens's loose sentence "bombardment.js imported ONLY by three test
files" is incomplete (crystal imports `craterSchedule`), but the plan's PRECISE
claim (the EDITED symbols `craterAmplitude`/`craterProfile` → 3 files) was correct;
§4 now states both.
