# Inc-3 BUILD-PLAN — relief-scale spine + crater depth-law correction

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

### 0.2 Which height families the multiplier ACTUALLY reaches — EXISTS, partial

Grep of `reliefNorm(` consumers in `planet-lod-lab.html` (the per-frame uniform
block, ~L5602–6002). **Five families are reached today:**

| Uniform (symbol) | Height arg | gravity arg | note |
|---|---|---|---|
| `uPerturb` | `mountainHeightKm` | `_gNow` | global relief displacement |
| `uEcuCanyonDepth` | `canyonDepthKm` | `_gNow` | |
| `uCraterAmp` | `craterDepthKm` | `_gNow` | in-shader **F2 synth** crater channel |
| `uMountainAmp` | `mountainHeightKm` | `_gNow` | ×enable ×exotic ×relevance |
| `uEdificeAmp` | `edificeHeightKm` | **`1.0`** | g passed as 1.0 — gravity already in `uEdificeMaxHeight` (core ∝1/g); the ONE family that *already* documents a double-dip guard |

**Height/displacement uniforms NOT reached by `reliefNorm` today** (raw
`state.*` pass-through): `uChasmaDepth`, `uWrinkleAmp`, `uPolarAmp`, `uFacetAmp`,
`uHexBorderDepth`, `uShatBorderDepth`, `uEjectaAmp`, `uCryoRidgeAmp`,
`uGlacialAmp`, `uLineationAmp`, `uSubAmp`, `uFluvialDepth`, `uOutflowDepth`,
`uKarstDolineDepth`, `uKarstMazeDepth`, `uTalusAmp`, `uLobeAmp`, `uDuneAmp`,
`uDustDepth`, `uFrostNoiseAmp`, `uDeltaAmp`.

**What CHANGES:** the Derivation Note (§1) **classifies** every one of these into
`{macro-relief → wire the bounded envelope | carrier-baked → envelope at the
composite seam, no double-dip | micro-texture/albedo → out of the km-relief
family, documented}`. S1 wires only the macro-relief set. This is the audit's
"radius visibly expressed in ALL height-bearing families" promise, executed
**as a classification, not a blind 20-uniform sweep** (over-wiring risk — §Risks).

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
`1/R`**:

- `src/worldengine/base/tectonic.js` → `writeHeightSphere`/`runE6`:
  `baseAmp = 0.6 · gCap · (0.3 + 0.7·silicate)`, `gCap = reliefGravityFactor(g)`
  — a **private local copy** `reliefGravityFactor(g)` (L167), NOT an import of
  core. Reads `g` only.
- `src/worldengine/base/magmatism.js`: uses its own `gFactor` (the "house
  `reliefGravityFactor` convention; gFactor = 1 at reference gravity → byte-safe").
- `relief-e6-tectonic.js`: its own local `reliefGravityFactor(g)` (L67).

**Consequence:** the footnote-14 double-dip exists **only in the lab's
`reliefNorm`** (explicit `1/R` × a g-term that already carries R post-coherence).
The carrier families are already g-only ⇒ **no carrier edit, no golden
re-capture** for them. The Derivation Note documents this by grep, it does not
change it.

### 0.5 The composite/bake seam — EXISTS

`planet-lod-rivers.js` → `compositeMargins(carrier)` returns
`height + shelfDepth + craterField` (raw sum) → baked into `uReliefBakeCube`;
render branches on `uReliefBakeStrength` (default 0) between baked-carrier and
in-shader synth. The carrier `craterField` amplitudes flow through here
**unmultiplied by `reliefNorm`**. This is the "composite/bake-seam" the
designDecision names; the depth-law fix (§0.3) corrects the craterField at
source, so the bake carries correct d/D without a seam multiplier.

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
never both — because `g` is now a function of `R`. The strength-limited relief
law itself is single-signal: `h_max/R ∝ σ/(ρ²R²)` at fixed density, and with
`g = (4/3)πGρR ⇒ R ∝ g/ρ`, that is `∝ 1/g²` (fixed ρ) — the **same** signal
expressed once, not `1/R` and `g^-q` multiplied.

### 1.2 Exponent ledger (every height-bearing family)

| Family / seam | radius channel today | double-dip? | resolution |
|---|---|---|---|
| **`reliefNorm`** (lab macro-relief) | explicit `1/RE` **×** `g^-0.5` | **YES** (the convicted defect) | **drop `1/RE`**; `reliefEnvelope(R,g)=clamp(g^-Q_RELIEF, FLOOR, CEIL)`, `Q_RELIEF≈0.58` (§2). Radius via g. |
| `uEdificeAmp` | `g=1.0` passed (g already in `uEdificeMaxHeight` core ∝1/g) | already-guarded | keep the `g=1.0` guard; wire the *radius* half through `reliefEnvelope` with the same single-signal discipline (S1 detail). |
| `tectonic` height (`carrier.height`) | `g^-0.5` only, no `1/R` | no | **document, do not edit** (golden-baked; §0.4). |
| `magmatism` height | `gFactor` (g only) | no | document, do not edit. |
| Crater **depth** (`craterAmplitude`) | angular δ; g enters only at `D_t(g)` transition | no | new law reads g **once** (transition), δ for size. §2. |
| Crater **count/size** (`craterSchedule`) | `R²` (count), `radPerKm∝1/R` (size), `g^-K_GS` (size) | no (shipped v2-6, distinct effects) | **untouched** — count∝R², size∝1/R and g^-0.17 are separate physical laws, not a relief double-dip. |
| micro-texture (`uDuneAmp`, `uDustDepth`, `uFrostNoiseAmp`, `uTalusAmp`, `uLobeAmp`) | none (raw) | n/a | **out of the km-relief family** — surface textures whose amplitude is not a km-authored relief height. Document as deliberate non-consumers; do NOT wire the envelope. |
| macro-relief not-yet-reached (`uChasmaDepth`, `uWrinkleAmp`, `uPolarAmp`, `uFacetAmp`, `uHexBorderDepth`, `uShatBorderDepth`, `uCryoRidgeAmp`, `uGlacialAmp`, `uLineationAmp`, `uSubAmp`) | none (raw) | n/a | **candidates to wire** `reliefEnvelope` (g-only) in S1 — each is a km-scale displacement that SHOULD track the drawn body. Wire, and unit-assert no explicit `1/R` is added. |
| water-cut depths (`uFluvialDepth`, `uOutflowDepth`, `uKarstDolineDepth`, `uKarstMazeDepth`, `uDeltaAmp`, `uEjectaAmp`) | none (raw) | n/a | **S1 review call** — erosional/ejecta depths; wire g-only IF they are km-authored relief, else document as out-of-family. Default: wire the km-authored ones, document the rest. |

**Sign discipline (all families):** lower g ⇒ higher relief/R (correct, kept).
**Magnitude discipline:** the envelope multiplier is bounded `[FLOOR=0.40, CEIL=133]`
so apparent relief/R ≤ 0.40 (Phobos ceiling) at any degenerate draw.

---

## (2) CALIBRATION-FIRST — the derived laws (committed, runnable, reproduce)

Two STEP-0 pre-checks, v2-5/v2-6 pattern (pure `node`, no dev server, no
`claude -p`), committed with this plan. **Re-run to reproduce every number.**

### 2.1 `calibration/relief-envelope.mjs` — the envelope law

Derives the strength-cap replacement for the uncapped `1/RE`:

```
reliefEnvelope(R, g) = clamp( g^-Q_RELIEF , RELIEF_FLOOR , RELIEF_CEIL )
Q_RELIEF   = 0.58   (least-squares through the distributed-relief anchors, forced Earth=1)
RELIEF_FLOOR = 0.40 (high-g worlds subdued, not flat)
RELIEF_CEIL  = 133  (= CEIL_APPARENT 0.40 / REF_RELIEF 0.003; binds only on degenerate g→0)
```

Anchor roles: **distributed-relief bodies** (Earth, Mercury, Mars, Moon, Mimas)
are fit + band-gated; **basin-dominated extremes** (Phobos=Stickney, Vesta=
Rheasilvia — a *single* giant crater, a bombardment effect, not a strength
envelope) are the **ceiling reference** (assert apparent ≤ 0.40), reported not
fit. Verified output (reproduces):

| body | old× | new× | apparent | band | verdict |
|---|---|---|---|---|---|
| Earth | 1.00 | 1.00 | 0.0030 | [0.002,0.01] | OK |
| Mercury | 4.25 | 1.76 | 0.0053 | [0.003,0.01] | OK |
| Moon | 9.02 | 2.84 | 0.0085 | [0.008,0.05] | OK |
| Mimas | 80.4 | 18.6 | 0.0558 | [0.04,0.15] | OK |
| Phobos | 1437 | 55.0 | 0.1649 | ≤0.40 | CEIL-REF OK |
| **WORKED (0.27,0.28)** | **7.00** | **2.09** | **0.0063** | [0.003,0.05] | **OK** |

Worked case collapses **7.00× → 2.09×** (3.35× reduction); apparent 0.70 → 0.0063
(molten → Moon/Mercury band, ≪ 0.40 ceiling). Sign preserved (monotone). The
linear apparent-model is conservative (shader normal-saturation only compresses
the top further); the live AC-LAB-READ metric confirms the render.

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

### S1 — envelope law + derivation note + consumer wiring (render-side, AC-ENVELOPE, AC-0)

1. **Add** `planet-lod-lab-core.js` → `export function reliefEnvelope(radiusEarth, surfaceGravity)`
   = `clamp(g^-Q_RELIEF, RELIEF_FLOOR, RELIEF_CEIL)` with the §2.1 constants
   (export the constants too). Do **not** edit `reliefGravityFactor` /
   `reliefAmplitudeFromKm`.
2. **Rewire** `planet-lod-lab.html` `reliefNorm` to call `reliefEnvelope(RE, g)`
   (drop the `(1/RE)·gCap` product). Keep the `heightKm` parameter for signature
   stability / future per-feature authored heights, but it no longer drives the
   radius term.
3. **Wire the macro-relief candidates** (§1.2 "candidates to wire" row) through
   `reliefEnvelope` (g-only), following the `uMountainAmp` idiom (× enable ×
   relevance where present). Resolve the "S1 review call" water-cut/ejecta row:
   wire km-authored relief, document the rest as out-of-family in BUILD-NOTES.
4. **Derivation Note** (§1) lands in BUILD-NOTES as the AC-0 named-consumer
   record: `reliefEnvelope → {the wired uniform list}`; grep-proof that no wired
   writer adds an explicit `1/R`; taxonomy/drift guards green; no new `*Enabled`
   key.
5. **Unit tests** (new `tests/worldengine-inc3-relief-envelope.test.js`): anchors
   in band; worked case in band + ≤0.40; sign monotone; clamps bind; `reliefEnvelope`
   reads g only (no `radiusEarth` term in the returned value — a spy/structural
   assert). Derivation-note exponents cross-checked against the exported constants.

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
5. **Fence harness** (§5) — the fixed-seed population-invariance proof.

### S3 — population-sweep envelope gate + frozen-trace + BUILD-NOTES + evidence prep (AC-POPSWEEP, AC-FROZEN-TRACE)

1. **Extend the population harness** (copy v2-6 `population-sweep.mjs` into this
   dir's `calibration/`, or extend in place) with a **NEW envelope gate**: across
   ≥64 seeds × all archetype presets, `reliefEnvelope(R_drawn, g_drawn)·REF_RELIEF`
   lands in the AC-ENVELOPE band (≤0.40 hard, per-archetype band soft); assert all
   existing gates (coverage, variance, E1-diversity, goldens) stay green (depth
   edits don't move coverage — §5). Run live; commit the summary JSON.
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
   Derivation Note), the two calibration records, the frozen-trace number, the
   Copernicus residual, deviations, suite baseline at the seam.
4. **Evidence prep** for the coordinator's later live AC-LAB-READ / AC-UAT drive:
   the paired same-worldSeed protocol + the stated metric (rim-arc contrast /
   surface-normal distribution) — spec only; **no browser work here** (coordinator's).

---

## (4) TEST-EDIT ENUMERATION

**Principle:** calibration constants are NOT golden-fixture material; **no golden
re-capture** anywhere. Depth constants are pinned by *behavioral* asserts, not
literal-value pins — so most survive unchanged.

| File | Location | Current | Edit |
|---|---|---|---|
| `tests/worldengine-v2-6-craters.test.js` | clean-floor exactness, `expect(cr.floorValuePreClamp).toBe(Math.fround(-craterAmplitude(cr.delta)))` (~L147) | oracle recomputes amplitude angular-only | **EDIT** → compare to the diag's actually-stamped amplitude: `Math.fround(-cr.A)` (diag now stores `A = craterAmplitude(delta, D_km, g)`). Necessary because the writer stamps the complex amplitude. |
| `tests/worldengine-v2-5-bombardment.test.js` | `expect(craterAmplitude(D_REF_RAD)).toBeGreaterThanOrEqual(MIN_BASIN_DEPTH_N)` (~L121) | 0.18 ≥ 0.08 | **NO EDIT** — new simple A(D_REF)=0.10 ≥ 0.08 still holds (angular-only ⇒ simple regime). Review-confirm only. |
| `tests/worldengine-v2-5-bombardment.test.js` | `craterProfile` two-signed (~L111–118) | angular-only | **NO EDIT** — shape unchanged; passes. |
| `tests/worldengine-v2-6-ice.test.js` | ε=0 bit-identity `relaxedCraterProfile(s,D,0,0)===craterProfile(s,D)` (~L57); dome test (~L81–85) | angular-only | **NO EDIT** — both default to the simple branch; identity holds. Verify after the signature change. |
| Import lines (`D_REF_RAD`, `MIN_BASIN_DEPTH_N`, `MESH_FLOOR_RAD`) | v2-5 test L33 | — | **NO EDIT** — those exports are kept. |
| `CRATER_DEPTH_N` / `DEPTH_POW` literal pins | — | none exist (grep: only `bombardment.js` + this doc) | **NONE** — no test pins these constants, so retuning them breaks no assertion. |

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
     with **only `craterField` amplitude values differing** (assert ∃ i where
     `cf_pre[i] ≠ cf_post[i]` AND the tuple set is unchanged).

3. **Baseline not grown.** Full `npx vitest run` **from the repo dir** = **4
   known failures** (KnownObjects ×3, GalacticFeatures ×1) + vendor/motion-test-kit
   collection noise — never "fixed," never grown. The two new test files are
   all-green additions.

---

## Risks I could not fully resolve (surfaced, not buried)

1. **`reliefEnvelope`'s linear apparent-model is first-order.** The mapping
   multiplier→apparent-relief/R involves the shader's normal saturation, which I
   could not derive from the GLSL in-plan. Mitigation: the linear model is
   *conservative* (saturation only compresses the top), and the **live AC-LAB-READ
   metric** (coordinator) is the real gate. If the live render still reads hot,
   `Q_RELIEF` / `CEIL` retune is a one-constant calibration change (no carrier).
2. **"ALL height families" scope is a classification, not a settled list.** The
   §1.2 "candidates to wire" + "S1 review call" rows require a judgment pass in S1
   (which raw uniforms are km-authored macro-relief vs micro-texture). Over-wiring
   (e.g. treating `uDuneAmp` as relief) would visibly flatten/inflate textures.
   Mitigation: wire conservatively, document every non-consumer, and the
   population-sweep envelope gate catches an out-of-band family.
3. **Depth-law mid-complex residual (Copernicus 0.070 vs 0.040).** The single-SPA-
   anchor fit under-shallows the mid-complex range by ~1.7×. Shape/extremes/
   monotonicity are correct and the render goal (kill the inversion + hemispherical
   pits) is met; tightening `P_COMPLEX` against a second anchor is deferred, flagged
   in BUILD-NOTES, not silent.
4. **`D_t(g)` uncapped for tiny bodies is intentional but untested live.** On a
   sub-Mimas draw `D_t` exceeds the body radius, so every rendered crater stays a
   simple d/D=0.20 bowl — physically the correct "bowl-covered small world" read,
   but only asserted in calibration, not yet seen live (coordinator's AC-LAB-READ).
