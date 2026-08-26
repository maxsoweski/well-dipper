# Inc-3b BUILD-PLAN — relief-variance budget + crater legibility

Workstream `world-engine-inc3b-relief-budget-2026-07-21` · L1 tree,
`feature/world-engine-production-L1`, HEAD **`4269689`** (verified this session — the
contract `statusNote`'s `041d7a8` is the *predecessor* diagnosis commit, now stale;
Inc-3 depth-law + envelope are already shipped in the tree). Companion to
`contract.json` (the 11 ACs + 20 designDecisions incl. R1–R4), `intent.md` (the why),
and `~/briefings/grounding-relief-budget-2026-07-21.md` (the panel synthesis).
Durable-doc discipline: anchors are **symbols**; line numbers are transient
"current location (HEAD 4269689)" hints, all re-verified below.

**Line of sight (feature → driving outcome):** the World-Engine charter's
condition-first promise is that a *drawn* world reads as the body its scalars
describe. Inc-3 shipped the correct crater **physics** (Pike d/D, `g^-0.58`
envelope) but the fresh-session diagnosis (`041d7a8`) **measured** craters at
**~1.5% of the composited relief budget** under the generic despun terrain,
**envelope-independently** — so the right physics rendered invisible. Max's Inc-3
UAT: *"1. No, still looks the same 2. Frozen looks just like 1… with a different
color pallette 3. They do not [vary]"*. This increment reallocates relief variance
at the composite seam so `craterField` dominates **at preserved total band** — the
last blocker between "crater physics is correct" and "a small airless world looks
cratered" (Player-Experience tier: *believable worlds*).

**This plan is a DRAFT** feeding the adversarial BUILD-PLAN lens workflow
(byte-safety + mechanism lenses → revise) before the sliced S0–S4 build in a fresh
session (Max's directive). §6 surfaces the open tensions I hit for that lens pass —
they are flagged, **not silently resolved**.

---

## (0) GROUND TRUTH — what EXISTS at the seam today

> The v2-4 lesson (contract designDecision-6 lineage): the driver-wiring audit once
> *assumed a seam that did not exist*. Every seam below was read at HEAD `4269689`
> this session with file:line, and the four most-affected suites were **run green**
> (52 tests) as the pre-build baseline. Nothing here is inferred from the brief.

### 0.1 The composite seam — `compositeMargins(carrier)`, one-arg, ONE runtime caller

`planet-lod-rivers.js:210` `export function compositeMargins(carrier)` returns a
**new** `Float32Array`, `out[i] = h[i] + sd[i] + (cf ? cf[i] : 0)` (`h`=carrier.height,
`sd`=shelfDepth, `cf`=craterField), or **`null`** when both overlay channels are
all-zero (:212–216 early-outs). It **never mutates** `carrier.height` (own-channel
discipline; the 75-golden bypasses `route()`).

- **Sole runtime caller:** `route()` at `planet-lod-rivers.js:1322`
  `const composited = compositeMargins(carrier);` — grep-confirmed repo-wide the ONLY
  non-test call site. **8 test call sites** (re-counted at HEAD: `worldengine-v2-5-preset-composite.test.js`
  lines 99, 104, 108, 114, 122, 129, 136, 140), all one-arg. **9 callers total** (1 runtime
  + 8 test) — the earlier draft's "7 test / 8 callers" was off by one (lens-log M5/m-8; the
  count is harmless because every call is one-arg → `IDENTITY`, but the enumeration the fence
  rests on must be exact).
- **Consequence for S1:** extending to `compositeMargins(carrier, budget = IDENTITY)`
  with the **default** keeps all 9 existing callers (1 runtime + 8 test) on the
  identity path with **zero edits** — the AC-FENCE "existing callers still call
  one-arg and pass" invariant holds by the default-parameter construction (`1.0*x === x`
  bit-exact for all `x` in IEEE-754, so `IDENTITY` reproduces `h+sd+cf` byte-for-byte).
- **Why the budget can even ACT on Moon/Mercury (the seam the null-early-out could have
  killed — lens-log m-3):** `shelfDepth` and `craterField` are allocated **universally at
  carrier creation** (`src/worldengine/base/substrate.js:17/:19`, `sphereField.js:20/:22`),
  so the `if (!sd) return null` guard (:211) is never hit. On the Moon/Mercury despun path
  `shelfDepth` stays **all-zero** (no plate path → `writePassiveMargins` never runs, tail
  :562) but `craterField` **populates** (`writeBombardment` is UNIVERSAL, self-gates on
  airless+dead+cold, tail :563) → the `any` scan (:214) finds a nonzero `cf[i]` → non-null
  return → the composite runs → the budget reallocates. Verified, not assumed (the v2-4
  "don't assume the seam" lesson): without the universal `craterField` allocation the budget
  would be a no-op on the very preset it targets.

### 0.2 The relief return-object idiom — the verified attach point for `relief.reliefBudget`

Inside `writeBodyRelief(carrier, bodyDrivers)` (`planet-lod-rivers.js:453`), the
condition-bearing branch binds `const cond = bodyDrivers.condition;` at **:468**, and
at the tail (**:568–569**) attaches pure return-object fields **on every dispatch
path**:

```
relief.figure          = deriveFigureDescriptor(cond);              // :568  (no carrier array, no RNG ⇒ byte-inert)
relief.surfaceMaterial = deriveSurfaceMaterial(cond, craterSchedule(cond));  // :569  { iceness, crystallizationPotential, regolithRoughness }
```

`cond` is in scope at :569. **S1 attaches `relief.reliefBudget = deriveReliefBudget(cond, craterSchedule(cond))`
in the identical idiom** (byte-inert: return-object field, no carrier array, no RNG).
`route()` captures `const relief = writeBodyRelief(...)` at **:1282**, so
`relief.reliefBudget` is available where `compositeMargins` is called at :1322 →
S1 threads it: `compositeMargins(carrier, relief.reliefBudget)`.

> **Live idiom note:** `relief.surfaceMaterial.regolithRoughness` is populated at :569
> but consumed **nowhere** today — it "dies inside route()". That is the S3
> `route()→uniform` plumbing target (§1.S3), *not* an S1 concern.

### 0.3 The despun() path — where Moon/Mercury (and Frozen, Mars) get their base terrain

`planet-lod-rivers.js:492–496` `despun()` = `writeGrainSphere(carrier, grainDrivers)`
then `writeHeightSphere(carrier, {}, grainDrivers, { name: 'tectonic-build' }, heightSeed)`.
Moon/Mercury routes here via the dead-lid rocky fall-through (`return despun()` at
:560). **The "Venus-like plateau landforms" Max saw** are `writeHeightSphere`'s
`tectonic-build` crust term: `tectonic.js:155` `const plateau = Math.max(0, blob-0.55)*1.6`
(3D path) / `:218` (2D path), keyed off `:e6plateau` noise. The budget's `w_e≈0.17`
endo-suppression makes this recede — **no `tectonic.js` edit** (the plateau is the
endo channel we down-weight, not a bug to excise).

### 0.4 The radius-unlock seam (R3) — `drawPresetRadius` + `NAMED_BODY` + the archetype-less fall-through

`driver-presets.js:249` `drawPresetRadius(presetName, seed)`:

```
const canonical = preset.radiusEarth ?? 1.0;
if (NAMED_BODY.has(presetName)) return canonical;                 // :252  ← Moon/Mercury is here (:242)
const arch = PRESET_ARCHETYPE[presetName];                        // :253  ← Moon/Mercury has NO archetype entry
const range = arch && RADIUS_RANGES_EARTH[arch];
if (!range) return canonical;                                     // :255  ← archetype-less fall-through ALSO returns canonical
const r = alea('draw:radius:' + (seed >>> 0))();
return range[0] + r * (range[1] - range[0]);
```

**Two independent facts that shape R3:**

1. `'Moon/Mercury (impact-airless)'` is in `NAMED_BODY` (`driver-presets.js:242`) **and**
   has **no** `PRESET_ARCHETYPE` entry (:205–232 — deliberately archetype-null, like
   Mars + Hot Jupiter). So **literally deleting it from the `NAMED_BODY` Set at :239 does
   NOT produce a draw** — it falls through to the archetype-less `if (!range) return
   canonical` at :255. To get the `[0.27,0.38]` draw the preset needs **its own range
   entry** (contract R3: "not the archetype table"). This is a code fact, verified.

2. **`drawPresetRadius` callers, grep-verified repo-wide:**
   | Caller | Path | Passes canonical today via |
   |---|---|---|
   | `world-engine-lab.html:2984` `drawPresetRadius(driverUI.preset, state.radiusSeed)` | **LAB draw** (the R3 target) | `NAMED_BODY.has` → canonical |
   | `world-engine-lab.html:6194` `_lab.drawPresetRadius(...)` | AC5 pure-draw probe | `NAMED_BODY.has` → canonical |
   | `…/inc3…/calibration/population-sweep.mjs:162` `drawPresetRadius(name, s)` | **HEADLESS calibration** | `NAMED_BODY.has` → canonical |
   | `…/inc3…/calibration/frozen-ice-trace.mjs:49,63` | **HEADLESS calibration** | `NAMED_BODY.has` → canonical |
   | `…/v2-6…/calibration/population-sweep.mjs:129` `drawPresetRadius(name, s)` (lens-log M4) | **HEADLESS calibration** | `NAMED_BODY.has` → canonical |
   | `tests/worldengine-v2-6-drawlaw.test.js:41` `expect(drawPresetRadius(name,seed)).toBe(canonical)` | **TEST**, iterates `for (const name of NAMED_BODY)` (:37, canonical bound :39) | asserts canonical |

   **The contract's R3 claim "headless calibration … passes canonical radii explicitly,
   so the lock was never load-bearing" is FALSE for these two harnesses** —
   `population-sweep.mjs:162` and `frozen-ice-trace.mjs:49/63` call `drawPresetRadius(name, s)`
   and rely on the `NAMED_BODY.has → canonical` branch. A literal Set-removal +
   range-entry would make **both harnesses draw a random Moon/Mercury radius**,
   disturbing headless calibration — a **direct violation of the hard constraint
   "headless/test paths keep canonical radius."** See §6-T1 for the resolution
   (LAB-only opt-in param; Moon/Mercury **stays** in `NAMED_BODY`).

3. **The g-coherence R3 relies on is real:** `body-condition-vector.js`
> ⚠ **SUPERSEDED IN PART (gravity-selfcompression-2026-07-28).** The expression quoted here was the CONSTANT-DENSITY law `g = g_c·(R/R_c)`. It is now the piecewise self-compression law `g = g_c·f(R)/f(R_c)` — `f(R) = R^(4/3)` below 1 R⊕, `R^1.70` above — applied to the **rocky class only**. Byte-exactness at canonical is unchanged and is still the load-bearing property. The reasoning in this section is unaffected; only the exponent is. See `body-condition-vector.js` and `docs/WORKSTREAMS/world-engine-gravity-selfcompression-2026-07-28/`.

   (as written at the time of this plan:)
   `surfaceGravity = (derived.surfaceGravity ?? bodySurfaceGravity(fp)) * ((radiusEarth ?? R_c) / (fp.radiusEarth ?? 1.0))`
   — i.e. `g = g_c·(R/R_c)`, **byte-exact at canonical** (`R === R_c ⇒ R/R_c = 1.0`
   float-exact, :35–36). A drawn `R∈[0.27,0.38]` with `R_c=0.38` yields a coherent
   lower `g` → g-mediated crater deltas. The lab feeds the drawn radius to
   `deriveConditionVector(fp, u, state.planetRadiusEarth)` at :2790. **Off-canonical
   draws are the ONLY ones that change; every golden/headless/NAMED_BODY path passes
   `R===R_c` → byte-exact.**

4. **Re-roll wiring exists:** `newPlanet()` (`world-engine-lab.html:3871`) derives
   `state.radiusSeed = alea('draw:radius:'+state.worldSeed)()…` (:3873) and sets
   `state._radiusDirty=true` (:3876); the draw fires at :2983–2987 on preset-change or
   `_radiusDirty`. `craterOffset` stays `[0,0,0]` (:2428, reset :3141) — re-roll-invariant
   (the AC-REROLL / S3 rider concern).

### 0.5 The render / read-gate chain in the lab (S2/S3/S4 concern, UNCHANGED by S1)

Verified at HEAD (Inc-3's single-carrier envelope rewire is live):

- `world-engine-lab.html:5606` `uniforms.uPerturb.value = state.perturb * reliefEnvelope(_RE, _gNow)` —
  the ONE universal relief-strength carrier (`_RE`/`_gNow` stashed at :5601).
- `world-engine-lab.html:536` `float reliefAmp = uPerturb * mix(0.7,1.0,uLodRamp)` → `:537`
  `shadeN = perturbAnalytic(N, grad, reliefAmp)` — the whole accumulated `grad`
  (incl. every combiner's `grad +=`) scaled once by `uPerturb`.
- `reliefEnvelope(R,g) = clamp(g^-0.58, 0.40, 133)` at `planet-lod-lab-core.js:1006`
  (`Q_RELIEF=0.58` :1003; the `133` CEIL never binds — g-floor caps ≈55). **The
  crater:base RATIO is invariant under this** (it scales the composited SUM uniformly)
  — the Inc-3 diagnosis's core finding, and why the budget must act at the composite,
  not the envelope.
- `uCraterAmp.value = state.craterAmp` (:5957) — envelope **already removed** here
  by Inc-3 ("rides ONCE via uPerturb"); the R1 rider (no envelope in `uCraterAmp`) is
  **already satisfied at the amp level** at HEAD.
- `uCraterDensity.value = cratersEnabled ? craterDensity * featureRelevant.craters : 0`
  (:5952); `featureRelevant[key] = ASSOCIATIONS[key].rendersOn.includes(preset) ? 1 : 0`
  (:3012–3013) — **preset-name membership**. `craters.rendersOn`
  (`planet-feature-associations.js:74`, verified this session) =
  `['Frozen (airless)','Mars (arid rocky)','Rocky (Earthlike)','Eyeball','Ocean','Venus','Titan','Europa']`
  — it **lacks** `'Moon/Mercury (impact-airless)'`, so the in-shader F2 synth **cannot fire
  on Moon/Mercury today**. Adding the name is **BARRED** (AC-0). This is the S3 relevance-gate
  rework (condition-scalar re-derive).
- **Render-path asymmetry (lens-log m-2) — a real confound for AC-FROZEN and the S2 gate.**
  The same `:74` list **DOES contain `Frozen (airless)` and `Mars (arid rocky)`**. So the
  in-shader F2 crater synth (`uCraterDensity·featureRelevant.craters`) **can fire on
  Frozen/Mars but not Moon/Mercury**. If F2 contributes in the live baked branch by default,
  Frozen renders craters through **two** channels (baked `craterField` via the composite +
  F2 in-shader) while Moon/Mercury has **one** — which would (a) contradict AC-FROZEN's
  "statistically near-identical to Moon/Mercury," and (b) make any common S2 read-gate run
  across the two worlds **compare different pipelines**. **S0/S2 deliverable:** verify whether
  F2 contributes by default in the baked branch (read `cratersEnabled` default + the F2 grad
  path at `:398–400`/`:536–537`); if it does, either hold F2 off for **both** worlds until S3,
  or run the S2 gate on Moon/Mercury (single-channel) and treat Frozen's two-channel render as
  a documented difference — not silently. This is NOT a rendersOn edit (barred); it is a
  default-state audit.
- Light staging (AC-READ/AC-UAT recipe): `state.lightAzimuthDeg` (:2006, dflt 40.6) /
  `state.lightElevationDeg` (:2007, dflt 20.79); GUI `'sun azimuth°'` (:2644) /
  `'sun elevation°'` (:2645) → `applyLightDir` (:2617–2623) rewrites `WORLD_LIGHT`;
  `uLightDir` declared :209. "~70° incidence" ≈ low elevation (dflt ~20.8° elevation
  already ≈ 69° incidence — S0 pins the exact az/el).

### 0.6 The impact laws + domain-predicate scalars — `bombardment.js`

- `isImpactSurface(condition)` (:143) = `cold (T_eq<450 K)` **AND** `solidSurface (P<200 bar)`
  — condition scalars only.
- `craterSchedule(condition)` (:155) returns `{ fired, nAnalytic, nStamp, sizeMul, screen,
  tExp, coverage, R_km, D_LO_KM, D_HI_KM, D_FLOOR_KM, L_trunc, regolithRoughness }` —
  **all the domain-predicate scalars S0 needs** (`nStamp`, `tExp`, `coverage`, `fired`).
  The near-cliff cases are computed here: `tExp = min(age, T_RESURF_TIDAL/td,
  T_RESURF_ERODE/erosion)` (:174–176), degenerate when `nStamp` rounds to 0 (:183–193).
- Inc-3 depth-law constants are shipped: `CRATER_DEPTH_N=0.10, DEPTH_POW=1.0,
  D_D_SIMPLE=0.20, K_DT=3.1, P_COMPLEX=0.66` (:96–101). `writeBombardment` writes **only
  `craterField`** (unhashed) — byte-inert vs the 75-golden.
- `σ_imp/R` measured at boot ≈ `1.09e-3` (≈ real Moon), the number the budget
  reallocates *toward*.

### 0.7 The third g-term (triple double-dip audit, S0) — dormant

`tectonic.js:137/207` `const gCap = reliefGravityFactor(drivers.surfaceGravity ?? 1)`.
`DEFAULT_GRAIN_DRIVERS` (`planet-lod-rivers.js:112`) = `{despinAmp:1, radialStrainSign:1,
radialStrainMag:0}` — **no `surfaceGravity` key** — so `despun()` → `writeHeightSphere`
passes `grainDrivers` with no `surfaceGravity` → `gCap = reliefGravityFactor(1) = 1.0`
→ **inert**. Confirmed: the writer gCap is a third g-term but dormant under the rivers
path. (The two live g-terms: the render `reliefEnvelope` `g^-0.58`, and the depth-law
`D_t(g)=K_DT/g`.)

### 0.8 The fences that must hold — verified test posture

- `tests/v2-0-byte-identity.test.js` — 75 golden hashes (15 presets × 5 seeds).
  **Frozen is the ONE preset whose 5 rows moved** (V2-3 shell→despun reroute), asserted
  via **`despunRef(seed)` reconstruction** (:46, = `writeGrainSphere + writeHeightSphere`
  fresh output — the despun writer), **NEVER a re-capture** (the committed
  `v2-0-carrier-goldens.json` is immutable; other 70 rows strict-compare). Because the
  budget is **composite-side** and never touches the writer, `despunRef` (writer output)
  is untouched → Frozen's 5 HEIGHT rows stay byte-identical. **This is the AC-FENCE /
  AC-FROZEN mechanism.**
- `tests/worldengine-v2-5-preset-composite.test.js` — the composite suite; all **8**
  `compositeMargins(...)` calls are one-arg. **Green at HEAD.**
- `tests/relief-router-repoint.test.js` + `tests/relief-height-cube.test.js` — the two
  **route()-body source-scanners** (lens-log M3). S1 edits `route()` at :1322, so both
  must be re-verified at the seam. Both pin `marginHeight` / `marginGrad` /
  `const marginHeight = composited || carrier.height` / `bakeHeightCube({…height: marginHeight})`
  / `writeBodyRelief(carrier` (`repoint:64–84`, `height-cube:174–194`) — **none pin
  `compositeMargins` arity**, so the two-arg thread does NOT trip either. Listed **NO EDIT
  (verified)**; run at the S1 seam.
- `tests/worldengine-v2-3-dispatch-oracle.test.js` — the archetype-string denylist grep.
  It slices the `if (bodyDrivers?.condition){…}` block of `writeBodyRelief` by brace-match
  (`:259` `indexOf('function writeBodyRelief')` → `block(…, 'if (bodyDrivers?.condition)')`),
  so the **:569 attach line IS inside the sliced region** (this is the real AC-ORACLE fence —
  see S1.2 / lens-log M1). Denylist (`:266–273`): `PRESET_ARCHETYPE`, `\.label\b`,
  `stagnantLidRegimeOf(`, `isVolcanicPath(`, `isEarthlikePlatePath(`, `shellRegimeOf(`, bare
  `\barchetype\b`. **Green at HEAD.**
- `tests/worldengine-v2-6-drawlaw.test.js` — asserts NAMED_BODY presets return canonical
  (:36–44, iterates `NAMED_BODY`). **Green at HEAD** — and stays green iff Moon/Mercury
  remains in `NAMED_BODY` (§6-T1).
- `tests/worldengine-inc3-depth-law.test.js` — Inc-3 depth-law behavioral asserts.
  **Green at HEAD.**
- Reusable calibration patterns (predecessor `…/world-engine-inc3-relief-spine-depthlaw-2026-07-21/calibration/`):
  `population-sweep.mjs`, `fence-population-invariance.mjs` + `fence-baseline.json`,
  `frozen-ice-trace.mjs`, `relief-envelope.mjs`, `crater-depth-law.mjs`.
- **Pre-build baseline run this session:** the four affected suites above (composite,
  oracle, drawlaw, inc3-depth-law) = **52 passed**. The full-suite baseline is the
  **4 known failures** (KnownObjects ×3 + GalacticFeatures ×1) + vendor/motion-test-kit
  collection noise (not re-run here — expensive; asserted as the documented baseline
  S1/S4 must not grow).

### 0.9 The AC-BUDGET harness does NOT exist in the tree — MUST be authored (S0/S1)

Grep-verified: **no `inc3-amplitude-budget.mjs` (or any `*amplitude*` harness) exists
in the repo.** The contract itself says "(scratchpad, measured 1.14% crater:base at
N=40k seed 1)" — the `041d7a8` diagnosis harness lived in an ephemeral scratchpad.
**AC-BUDGET references a harness that is not committed.** S0 must author and commit a
canonical amplitude-budget harness into **this** workstream's `calibration/` dir
(measuring `height RMS`, `craterField RMS`, ratio, and — with the budget wired — `f_I`,
`w_e/w_i`, and post-budget total composite RMS), reproducing the `~1.14%` pre-budget
number as its self-check. See §3-R7.

---

## (1) SLICE SPECS

### S0 — calibration (closed-form, NO code ship)

**Deliverables (all committed to `calibration/`, all pure `node`, no dev server, no
`claude -p`; every number reproduces on re-run):**

**S0.1 — relic-Λ 2-anchor fit (`calibration/relic-lambda.mjs`).** Fit
`σ_endo/R = C_RELIC · g^-Q_RELIEF · max(Λ_FLOOR, Φ_peak^{P_Λ}) · (1 − K_IR·iceness)`
on the **two** exactly-identified anchors: Mercury (`σ_endo/R ≈ 1.8e-4`) and Moon
(`≈ 2.5e-4`) → `P_Λ ≈ 0.25`. **Reuse `Q_RELIEF=0.58`** (import from
`planet-lod-lab-core.js` — no second strength exponent). Declared **domain: dead-lid
impact-retentive worlds only**; Earth/live worlds **exit via the identity path**
(the Mercury+Moon `P=0.25` and Earth+Moon `P=0.69` fits are mutually exclusive — the
Earth anchor leaves the fit rather than breaking it). `Λ_FLOOR≈0.05` keeps the despun
fabric as a faint substrate. `K_IR` Callisto-targeted, reported as moving Frozen only
modestly (`iceness=0.3704 → Λ≈0.18–0.2`, `f_I≈0.97`). **Every constant carries a
derivation + anchor; the training-sourced real-body RMS/attribution values are cited
as medium-confidence in the script header** (per contract's no-taste-constants bar +
brief §4 calibration-honesty).

**S0.1a — anchor-sensitivity sweep (lens-log m-1; REQUIRED before the f_I band is frozen).**
The 2-anchor fit is **exactly identified** — two anchors, two free params (`C_RELIC`, `P_Λ`)
⇒ zero residual, **no goodness-of-fit is possible** (the fit cannot be validated, only
asserted). And downstream `f_I` is anchor-sensitive: a within-uncertainty ±20% move in the
Moon `σ_endo` anchor swings `P_Λ` ≈0.25→0.58 (~2.3×), and doubling `σ_endo` moves `f_I`
0.97→0.83 / `w_e` 0.17→0.42 on the **non-anchor** in-domain worlds (Frozen, Crystal). The
qualitative read (crater-dominant, `w_e<0.5`) is robust across the sweep, but AC-BUDGET's
"`f_I` in the S0 band" can spuriously pass/fail if the band is set tight. **Deliverable:**
run the ±20%/×2 anchor sweep, table the resulting `f_I` spread per in-domain world, and
**derive the frozen f_I band wide enough to absorb the medium-confidence anchor uncertainty**
(not a point value). The band width is itself a derived number, not a taste constant.

**S0.2 — f_I law + normalization choice (`calibration/relief-budget-fit.mjs`).**
`f_I(cond) = σ_imp² / (σ_imp² + σ_endo²)`. `σ_imp` from the shipped impact laws
(`craterSchedule`, LAW-I, unchanged). **Normalization decision (brief §2.1 — the
explicit S0 decision):** closed-form schedule statistics (N-independent) vs per-carrier
RMS. **Stated determinism argument + the RMS-preservation split — see §6-T2** (this is
a genuine tension: `reliefBudget.js` must stay a pure condition-scalar leaf per AC-0,
yet AC-BUDGET wants *exact* total-RMS preservation; S0 must adjudicate and FREEZE the
choice). Worked boot outcome to reproduce: `f_I≈0.97, w_e≈0.17, w_i≈O(90)`, crater:base
variance inverted, total RMS preserved.

**S0.2a — the w_e/w_i solve, WRITTEN DOWN (lens-log MF-1; without this AC-BUDGET has no
fixed referent).** The two constraints (var-ratio `= f_I/(1−f_I)` AND total composite RMS
unchanged) have a unique positive closed-form root; S0 must pin it, not just the rounded
outcome. With `V_h = Var(height)`, `V_cf = Var(craterField)`, `r = f_I/(1−f_I)`, holding
`shelfDepth` at weight 1 (so `V_sd` cancels) and assuming `Cov(h,cf)≈0`:

```
w_e² = (V_h + V_cf) / (V_h · (1 + r))
w_i² = r · w_e² · V_h / V_cf
```

Verified this session: `V_h=0.09606²`, `V_cf=0.001094²`, `f_I=0.97` → `w_e=0.1732`,
`w_i=86.48`, RMS-preservation **exact** (`w_e²V_h + w_i²V_cf == V_h + V_cf` to 1e-12),
var-ratio `== r` exact. Three things S0 MUST additionally pin, each a hard-constraint hook:

1. **Variance definition (AC-BUDGET's "RMS" is currently undefined).** State whether
   "RMS" is about-the-mean (`Var`) or raw `√(mean(x²))` — they differ when the channel
   mean ≠ 0, and AC-BUDGET's tolerance is meaningless until this referent is frozen. Freeze
   one; the harness (§0.9) and the AC use the same definition.
2. **The model-f_I ÷ realized-norm split is LOAD-BEARING (the whole increment only bites
   because of it).** `f_I` (hence `r`) MUST come from the **model** `σ_imp/σ_endo` (relic-Λ,
   §0.1) — NOT from the realized carrier norms. Proof of why: if the builder derives `r`
   from the realized norms it already reads inside `compositeMargins` (`r := V_cf/V_h`), then
   `w_e² = (V_h+V_cf)/(V_h(1+V_cf/V_h)) = 1` **exactly** — the budget silently collapses to
   identity (verified numerically this session). The model `σ_endo/R≈2.5e-4` is ~380× smaller
   than the realized height RMS 0.096; the **ratio** is model-derived, the **absolute scale**
   is realized-derived, and conflating them is the failure mode. S0 states this split as the
   reason `reliefBudget.js` emits the ratio target and `compositeMargins` supplies the scale
   (the §6-T2 option-(ii) resolution).
3. **Degeneracy guard `V_cf → 0` (a permitted in-domain state).** An in-domain world with
   `nStamp=1` and a single sub-floor crater has `V_cf → 0`, and `w_i² = r·w_e²·V_h/V_cf → ∞`
   (verified: `w_i` = 94.6 / 2992 / 9.5e4 at `V_cf` = 1e-6 / 1e-9 / 1e-12). Option (ii)'s
   "solve the scale from realized norms" blows up here. **Freeze a clamp:** when realized
   `V_cf < ε` (ε derived from the smallest single-stamp variance the schedule can produce),
   fall back to the IDENTITY path (`w_e=w_i=1.0`) rather than emit an unbounded `w_i`. The
   `ε` is a derived floor, tabled in S0, not a taste constant.
4. **Independence premise checked, not assumed (v2-4 lesson).** `Cov(h,cf)≈0` is used above;
   craters are Poisson-independent of tectonic height so it *should* hold — but S0 empirically
   measures `Cov(h,cf)` for the four in-domain worlds (one line in the harness) and records it,
   rather than asserting it.

**S0.3 — domain/continuity predicate + near-cliff enumeration.** State the predicate in
**condition scalars** (the same `craterSchedule` reads): impact-retentive `tExp`-band
`AND fired AND nStamp>0 AND has-shelf-or-crater`. Continuous or bit-exact-`w=(1,1)`
outside. **Enumerate:** Titan (`tExp=1.0, nStamp=0`) and Europa (`tExp=0.005`) as the
near-cliff worlds; run the affected-set enumeration (Moon/Mercury 147, Mars 132, Frozen
147, Crystal 104) and the null-path set into the contract as a committed table. The
composite's null topology is an implementation fact, **not** the physical predicate.

**S0.4 — triple g-term double-dip audit.** Prove the three g-terms don't double-count:
(a) render `reliefEnvelope` `g^-0.58` scales the composited SUM once (§0.5 —
ratio-invariant, so the budget is orthogonal to it); (b) depth-law `D_t(g)=K_DT/g`
(inside `craterField`, a size effect, not a relief strength); (c) writer `gCap`
(`tectonic.js:137/207`) **dormant** under `DEFAULT_GRAIN_DRIVERS` (§0.7). The budget's
own `σ_endo` `g^-Q_RELIEF` is the **endo-strength model** consumed only to compute the
ratio `f_I` — it is NOT re-applied render-side. Document the four g-touchpoints and why
they compose without a double-dip.

**S0.5 — bake-attenuation model + measured-edge geometry table.** Model the
256²/face cube 1-edge crater walls; geometry table in **measured edge units
(`1.11°`, NOT `0.573°`)** — the `2/√N`-vs-measured-edge inconsistency (panel R6).
**Arc-test thresholds derived here and FROZEN** before any capture (no post-hoc tuning):
the RNG-neutral centre-export probe spec (writer records centres with zero RNG draws, no
reordering — byte-fence-safe, verified against the fence-population harness), and the
`darkClipFrac/shadowFrac` re-baseline-after-flip protocol.

**S0.5a — the arc-asymmetry bar, un-smuggled (lens-log MF-2). The earlier draft presented
the whole bar "`≥70%` of `≥`-median lit-disc stamps show `≥1` posterize-band asymmetry" as
S0-model-derived and FROZEN. Only ONE of those three numbers is a model output; the other
two are acceptance conventions and, presented as "derived," they violate the no-taste-constant
constraint AND hollow the "frozen pre-capture" discipline (an un-derived gate number can be
quietly chosen post-capture to make the verdict land either way — exactly what
`feedback_perceptual-read-gate-before-uat` forbids). Split them:**

- **`≥1 posterize band` (the magnitude) — MODEL-DERIVED, and set on the DISTRIBUTION, not a
  point.** Derivable from the bake+Lambert+posterize chain: wall slope from the `1.11°`
  measured edge, incidence, band count. BUT 256²/face cube resampling of a `1.11°` wall has a
  **sub-texel phase** the model can only treat statistically → the per-stamp realized
  attenuation is a **distribution**, not a point. Set the `≥1-band` threshold on the model's
  **conservative tail** (state mean + spread), not the mean — a threshold set on the mean is
  systematically wrong for the tails. This number stays FROZEN pre-capture.
- **`≥70%` population fraction + `≥-median` size gate — ACCEPTANCE CONVENTIONS, not model
  outputs.** No line of the bake-attenuation model outputs "70%" or "median." Under the
  hard constraint, each must EITHER carry an explicit statistical justification (e.g. a
  binomial-power argument: "70% because with N≈147 stamps that is the fraction detectable at
  power β against the null of zero light-consistent asymmetry") OR be **flagged GUESSED with a
  resolution path** (e.g. "GUESSED 70%; resolution: calibrate against the reference DEM's own
  arc-asymmetry fraction under the same pipeline"). They may NOT be presented as
  "thresholds from S0's attenuation model." Whichever is chosen, it is frozen in
  `read-gate-thresholds.json` at the S0 seam with its justification/GUESSED tag inline.

**S0.6 — worked cases + arc thresholds frozen.** Moon/Mercury, Frozen, Mars, Crystal
worked points tabled; Mars `f_I` gate from real-Mars hypsometry asserted `∈[0.3,0.8]`
(NOT relic-law extrapolation). **All AC-READ bars written into a frozen
`calibration/read-gate-thresholds.json` committed at the S0 seam** (the pre-capture
freeze, `feedback_perceptual-read-gate-before-uat`).

- **Files touched:** NEW `calibration/relic-lambda.mjs`, `calibration/relief-budget-fit.mjs`,
  `calibration/domain-predicate.mjs`, `calibration/gterm-audit.md` (or `.mjs`),
  `calibration/bake-attenuation.mjs`, `calibration/read-gate-thresholds.json`,
  `calibration/inc3b-amplitude-budget.mjs` (§0.9 — authored here, self-check reproduces
  the `~1.14%` pre-budget ratio). No `src/**`, no `.html`.
- **Tests added/edited:** **none** (S0 ships no code). The `.mjs` scripts are their own
  runnable proofs.
- **Gates at the seam:** each script runs clean under `node`; the affected-set table +
  frozen thresholds committed; grep the calibration dir for taste-constants (every
  number has a derivation comment).
- **Commit stub:** `inc3b S0: calibration — relic-Λ 2-anchor fit + f_I law + domain
  predicate + triple g-term audit + bake-attenuation model + FROZEN read-gate thresholds
  (no code ship)`.

### S1 — the seam: `reliefBudget.js` leaf + composite budget param + route threading + R3 radius unlock

**S1.1 — NEW leaf `src/worldengine/base/reliefBudget.js`** (condition scalars only,
imports nothing that reads labels/archetypes). Exports `deriveReliefBudget(cond,
schedule)` returning `{ inDomain, f_I, w_e, w_i }` (plus whatever the §6-T2 normalization
resolution requires). Reads: `f_I` from the shipped impact/relief laws (`schedule` =
`craterSchedule(cond)` for `σ_imp`; `σ_endo` from the S0 relic-Λ closed form using
`cond.surfaceGravity`, `Φ_peak`, `iceness`), the impact-retentive `tExp`-band predicate.
**No label/archetype/regime-string reads. No `craters.rendersOn` touch.** Outside the
domain: `inDomain=false`, `w_e=w_i=1.0` (the bit-exact identity contract).

**S1.1a — the leaf MUST be TOTAL (lens-log M2). `deriveReliefBudget` runs at `:569` on
EVERY `writeBodyRelief` call** — the 75-golden harness (`carrier-golden.mjs:99`), the
dispatch-oracle, the composite suite, crystal, ~40 suites, all 18 presets and the
gas/atmo/null-path worlds. A NaN/Inf `f_I` cannot move a hash (it's a return-object field,
never in `HASHED_FIELDS`), **but a THROW would cascade the whole suite RED.** So the leaf
must **short-circuit to IDENTITY before any `0/0`**: on `!isImpactSurface(cond)` or
`σ_imp²+σ_endo²==0` (gas/atmo worlds, degenerate `nStamp=0`), return `{inDomain:false,
f_I:0, w_e:1, w_i:1}` *before* dividing. Requirement asserted in the S1 unit test: the leaf
returns **finite** weights on all 18 presets (loop them) and **never throws** — the
identity-outside-domain contract is a totality contract, not just a byte contract.

**S1.2 — attach in the return-object idiom** at `planet-lod-rivers.js:569`:
`relief.reliefBudget = deriveReliefBudget(cond, craterSchedule(cond));` (mirrors
`relief.surfaceMaterial`; byte-inert — no carrier array, no RNG, populated on every
dispatch path). *(Micro-optimization option: reuse the single `craterSchedule(cond)`
already computed for `relief.surfaceMaterial` on :569 rather than calling twice —
builder's call, both are pure.)*

**S1.2a — AC-ORACLE build-guard: the attach line is the fence, NOT the leaf file (lens-log
M1). The earlier draft framed AC-ORACLE as "`reliefBudget.js` reads condition scalars only"
— that is the AC-0/Rule-15 spine fence (verified by the leaf's OWN grep test, S1 test list),
NOT what the dispatch-oracle checks.** The oracle greps only `planet-lod-rivers.js` and slices
the `if (bodyDrivers?.condition){…}` block — which **contains the :569 attach line** but NOT
the separate leaf file. So the load-bearing AC-ORACLE constraint is: **the :569 attach
EXPRESSION and the leaf's PUBLIC SYMBOL NAME stay free of the denylist tokens** (`archetype`,
`.label`, `stagnantLidRegimeOf(`, `isVolcanicPath(`, `isEarthlikePlatePath(`, `shellRegimeOf(`,
`PRESET_ARCHETYPE`). `deriveReliefBudget(cond, craterSchedule(cond))` is token-clean and
mirrors the existing `relief.surfaceMaterial` attach on the same line (which already passes),
so it holds by construction — **but do not name a helper `…Archetype…`/pass `.label` into that
line.** The new file-top `import { deriveReliefBudget }` is OUTSIDE the sliced region (import
lines precede `function writeBodyRelief`), so it is unrestricted.

**S1.3 — extend `compositeMargins(carrier, budget = IDENTITY)`** at
`planet-lod-rivers.js:210`. `IDENTITY` = the frozen `{ inDomain:false, w_e:1, w_i:1 }`.
Applied form inside the domain:
`out[i] = w_e·h[i] + sd[i] + w_i·(cf ? cf[i] : 0)`. **On `!budget.inDomain` (or
`budget===IDENTITY`), branch to the LITERAL pre-budget loop `out[i] = h[i] + sd[i] +
(cf ? cf[i] : 0)` — same float op order as today (lens-log m-7)** — rather than running the
weighted form with `w=1.0` and relying only on `1.0*x===x`. `1.0*x===x` is true in IEEE-754
so a unified branch would also be byte-safe, but the explicit literal branch makes AC-IDENTITY
**provable by inspection**, not merely by empirical byte-diff, and is what the S1 test asserts
(weights exactly `1.0`, and the `!inDomain` path reduces to the identical expression). The
RMS-preservation normalization lives here or in the leaf per §6-T2, and carries the S0.2a
`V_cf<ε` identity clamp. The `null` early-out (:212–216) is unchanged.

**S1.4 — thread it** at `planet-lod-rivers.js:1322`:
`const composited = compositeMargins(carrier, relief.reliefBudget);`.

**S1.5 — R3 radius unlock (LAB-only, opt-in — §6-T1 resolution).** In
`driver-presets.js`: add `export const LAB_UNLOCKED_RANGES = { 'Moon/Mercury (impact-airless)':
[0.27, 0.38] };` (its own range entry, NOT `PRESET_ARCHETYPE`/`RADIUS_RANGES_EARTH`);
add an **opt-in** param `drawPresetRadius(presetName, seed, { labUnlock = false } = {})`
that, **only when `labUnlock && LAB_UNLOCKED_RANGES[presetName]`**, draws
`lo + alea('draw:radius:'+(seed>>>0))()·(hi−lo)` **before** the `NAMED_BODY.has` check.
Moon/Mercury **stays in `NAMED_BODY`** (headless/test/probe paths, which omit the flag,
keep canonical — the hard constraint). Only the LAB draw site opts in:
`world-engine-lab.html:2984` → `drawPresetRadius(driverUI.preset, state.radiusSeed,
{ labUnlock: true })`. (Leave the `_lab` probe at :6194 flagless so it mirrors headless;
AC-REROLL's headless evidence harness opts in explicitly — §1.S4.)

- **Files touched:** NEW `src/worldengine/base/reliefBudget.js`; `planet-lod-rivers.js`
  (:210 signature, :569 attach, :1322 thread); `driver-presets.js` (LAB_UNLOCKED_RANGES
  + drawPresetRadius param); `world-engine-lab.html:2984` (labUnlock:true).
- **Tests added (new files, all-green, don't grow the baseline):**
  - `tests/worldengine-inc3b-relief-budget.test.js` — `deriveReliefBudget` unit:
    identity outside domain (`w_e=w_i=1.0` exact); `f_I` in the S0 band at the boot
    worked point; domain predicate excludes the null-path + Rocky/Ocean sets by
    condition scalar; **AC-0 grep** (source reads no label/archetype/regime string; no
    `rendersOn` reference); no new `*Enabled` key.
  - `tests/worldengine-inc3b-composite-budget.test.js` — `compositeMargins(carrier, budget)`
    arithmetic: budget applied → `w_e·h + sd + w_i·cf`; `budget=IDENTITY` (and one-arg)
    → byte-identical to the pre-budget sum (**AC-IDENTITY** Rocky/Ocean carriers;
    **AC-NULLPATH** the enumerated null-path carriers); total-RMS-preservation assert at
    the boot point (**AC-BUDGET**, calling the §0.9 harness or its exported fn).
  - `tests/worldengine-inc3b-drawlaw-labunlock.test.js` — flagless call returns canonical
    for Moon/Mercury (headless invariant); `labUnlock:true` draws strictly inside
    `[0.27,0.38]` and varies across seeds; other presets' draws **bit-unchanged** with or
    without the flag (R3 "must not disturb other presets").
- **Existing tests edited — ENUMERATED (each additive or adjudicated; NO re-capture):**
  - `tests/worldengine-v2-5-preset-composite.test.js` — **NO EDIT.** All 7
    `compositeMargins(carrier)` calls are one-arg → `budget=IDENTITY` → unchanged. Add a
    **NEW `it` block** (additive) exercising the 2-arg budget path if desired; the 7
    existing asserts are untouched. *(If a new block is added it is additive, not an
    edit to existing assertions.)*
  - `tests/v2-0-byte-identity.test.js` — **NO EDIT.** Budget is composite-side; `despunRef`
    (writer output) untouched; 75 goldens (incl. Frozen's 5 via `despunRef`) byte-identical.
  - `tests/worldengine-v2-3-dispatch-oracle.test.js` — **NO EDIT.** `reliefBudget.js`
    reads condition/derived scalars only → denylist untripped (verified by the AC-0 grep
    in the new leaf test; the oracle suite itself needs no change).
  - `tests/worldengine-v2-6-drawlaw.test.js` — **NO EDIT.** Moon/Mercury stays in
    `NAMED_BODY`; flagless `drawPresetRadius(name, seed)` still returns canonical (:41).
    **This is the load-bearing reason for the opt-in mechanism** — a literal Set-removal
    would silently drop Moon/Mercury from the `NAMED_BODY` iteration (still "green" but
    no longer *asserting* canonical) AND break headless calibration.
  - `tests/worldengine-inc3-depth-law.test.js` — **NO EDIT.** `bombardment.js` untouched
    this slice.
  - `tests/relief-router-repoint.test.js` + `tests/relief-height-cube.test.js` — **NO EDIT
    (verified — lens-log M3).** Both scan the `route()` body S1 edits at :1322; both pin
    `marginHeight`/`marginGrad`/`bakeHeightCube({…height: marginHeight})`/`writeBodyRelief(carrier`
    — **none pin `compositeMargins` arity**, so `compositeMargins(carrier, relief.reliefBudget)`
    does not trip them. **Run both at the S1 seam** to confirm.
  - **If any existing assertion is found to require an edit at build time, STOP and
    adjudicate — the contract bars edited/relaxed assertions (AC-FENCE: "zero assertion
    edits").**
- **Gates at the seam:** the four affected suites **+ the two route()-body scanners
  (`relief-router-repoint`, `relief-height-cube` — M3)** + the three new files green; full
  vitest at the 4-failure baseline (not grown); the §0.9 amplitude-budget harness green
  (AC-BUDGET); oracle grep untripped (AC-ORACLE, S1.2a fence).
- **Commit stub:** `inc3b S1: seam — reliefBudget.js leaf + compositeMargins(carrier,
  budget=IDENTITY) variance reallocation at preserved total band + route threading +
  R3 LAB-only Moon/Mercury radius unlock (opt-in; headless/goldens byte-exact)`.

### S2 — perceptual read-gate #1 (the flip ALONE; working-Claude LIVE)

Run the AC-READ bars **from the frozen S0 thresholds** against the S1 flip alone
(no S3). Working-Claude drives the lab via chrome-devtools at the **staged oblique
light** (S0's pinned az/el, ~70° incidence), N=40k, seed 1 + two re-rolls. Evaluate
and **record** (i) arc-asymmetry (S0.5a distribution-tail `≥1`-band threshold);
(ii) **blind read — NOT a single caption (lens-log m-6):** a single fresh-context caption is
a coin flip in both directions ("cratered" for any pocked sphere = false pass; "noisy rock"
for a genuinely cratered one under heavy dither = false fail). Spec **N≥3 independent
fresh-context captions AND a forced-choice** (present the render among distractor terrains,
"which is the cratered body?") so the bar is discriminative, not a single agent's whim;
(iii) **surface-class match against a RELIEF-DOMINATED reference (lens-log MF-4).** R2 makes
our render **pre-albedo** (relief only — no maria/highland contrast, no rays); matching it
against an **albedo-bearing** last-quarter-Moon photo is confounded because the shared
posterize/dither pipeline does NOT strip albedo (maria stay dark, rays persist), so the
reference carries cratering cues our render is designed to lack → the verdict is either
toothless (passes any lumpy sphere) or biased-to-fail (loses to the albedo-rich reference).
Use a reference with the **same information content as the pre-albedo render**: an **LRO/LOLA
shaded-relief DEM at matched sun az/el**, OR **Cassini Mimas** (near-albedo-uniform — the
contract's own alternative), both fetched (**no invented URLs**) and pushed through the SAME
posterize/dither/pixelScale pipeline. If a full-albedo photo is used instead, S0 must **bound
and annotate** the terminator-phase albedo contamination; the "same surface class" verdict is
read off **relief structure**, not albedo patches; (iv) full-phase control capture;
(v) crispnessRatio diagnostic-only. Evidence committed to `evidence/`. Verdict recorded
**whichever way it falls; Max pinged only after.**

- **PASS ⇒ S3 is demoted to its own later increment** (skip to S4).
- **Texture-FAIL ⇒ S3 fires (diagnose-first, R4).**

- **Files touched:** `evidence/` captures + a `S2-VERDICT.md`. No `src/**`.
- **Env:** discover the live vite port at drive time (§4); close chrome-devtools pages
  after (`feedback_agent-browser-window-hygiene`).
- **Gate:** the frozen bars evaluated + recorded; verdict filed.
- **Commit stub:** `inc3b S2: read-gate #1 (flip alone) — arc/blind/surface-class bars
  evaluated at frozen S0 thresholds; verdict recorded [PASS demotes S3 | FAIL fires S3]`.

### S3 — CONDITIONAL, DIAGNOSE-FIRST (built ONLY on an S2 texture-fail; R4)

**S3 is NOT a pre-authorized fix. It is a diagnosis gate.** Max, verbatim: *"i do not
want to just accept the old framework; if this is not working I want to diagnose and
fix. That may mean addressing something like the scale of the rendering… if that's our
issue."* Legacy-F2 adoption is **NOT pre-authorized**.

**S3.a — the diagnosis procedure (run FIRST, before any fix).** Distinguish **content**
(the sub-mesh crater population is genuinely absent — all 147 stamps are `>133 km`
complex dishes, the real `<133 km` texture band is unstampable at the mesh floor) from
**instrument** (the population IS present in `craterField` but the display eats it).

> **The discriminant is a GEOMETRIC INEQUALITY, not a step order (lens-log MF-3). The
> earlier draft's tree could not discriminate at the single most-likely failure mode** (brief
> §4 R1: 147 complex dishes, `<133 km` band unstampable): step 1 always finds craters
> (`nStamp=104–147`), so it never routes to the "genuinely sparse" content branch; step 2
> then listed "mesh density N / the ~133 km stamp floor" as an **instrument** suspect — while
> the brief classifies the identical mesh-floor phenomenon as **content** ("sub-mesh
> population absent"). The same measured state (147 dishes, weak render, sub-133 km void) was
> claimable by BOTH branches, and which one got "convicted" depended on which was evaluated
> first — a tree that presupposes its answer via ordering, precisely what R4 bars. Replace it
> with a sharp, non-overlapping cut on **resolvable-wall geometry:**
>
> Let `θ_floor` = the S0 model's **resolvable angular wall floor** (the smallest post-bake
> wall subtense the 256²/face cube + posterize chain can carry ≥1 band — computed in S0.5/S0.5a).
> For each stamp, compute its post-bake wall subtense `θ_wall(D, R, incidence)` from the
> carrier `craterField` (the RNG-neutral probe gives centres/depths). Then:
> - **`θ_wall ≥ θ_floor` but renders weak → INSTRUMENT** (the wall is resolvable; the display
>   is eating it → convict bake/posterize/pixelScale).
> - **`θ_wall < θ_floor` → CONTENT** (the wall falls below what any N can resolve at this mesh
>   → the population is unresolvable-at-N; the mesh-floor case lands **here, unambiguously**,
>   by the inequality — not by step order).

Measurement steps (feed the inequality, don't pre-decide):
1. Read the RNG-neutral centre/depth export (S0.5 probe) → stamp count, sizes, per-stamp
   `θ_wall`, and per-stamp arc-asymmetry **present in the data**.
2. Partition the stamps by `θ_wall ≷ θ_floor`. Compare **data** arc-asymmetry to **rendered**
   arc-asymmetry (S2 capture) within the `θ_wall ≥ θ_floor` set: signal in data, not on screen
   → **instrument**, convict the layer (bake attenuation / posterize-dither quantization /
   pixelScale).
3. If the read deficit is dominated by the `θ_wall < θ_floor` set → **content** (sub-mesh
   population unresolvable at N). Report the fraction of the read deficit each side of
   `θ_floor` owns, so the conviction is a measured split, not a narrative.

**S3.b — decision tree (fix at the CONVICTED layer only):**
- **Instrument convicted (bake / posterize / scale):** fix the rendering-scale/instrument
  path (explicitly in-domain per R4) — e.g. bake resolution, posterize band mapping, or
  the pixelScale — **no peppering**. Re-run S0.5's arc model to re-freeze thresholds if
  the instrument change moves the geometry.
- **Content convicted (sub-mesh population absent):** the peppering path — and it carries
  the render-skeptic riders **MANDATORY**:
  - condition-derived craters+ejecta relevance gate **re-derived from scalars**
    (`isImpactSurface`/schedule-derived); `craters.rendersOn` name-add **BARRED**
    (`planet-feature-associations.js:74` stays unmodified);
  - **envelope-free `uCraterAmp`** — `reliefEnvelope` must NOT re-enter `uCraterAmp`
    (already true at HEAD, :5957; keep it so — the convicted relief² defect);
  - **worldSeed-seeded `craterOffset`** (currently `[0,0,0]` at :2428 — re-roll-invariant;
    seed it so re-rolls move the field);
  - inherited-constant adjudication + a **SINGLE** density law (retire/reconcile the
    existing preservation-driven craterDensity/craterAmp chain — the "90% pre-built"
    framing is dead);
  - `provinceWeight` masking decision;
  - `regolithRoughness` plumbing `route()→uniform` (populated at
    `planet-lod-rivers.js:569`, consumed nowhere today — §0.2).
  - Mechanism per Max decision #4 (recommended: F2-adapted with the riders, framed as a
    substitution for item-8's diffusion path — **only if diagnosis convicts content**).

- **Files touched:** conditional — either the lab render/bake/posterize path (instrument)
  or the F2/relevance/offset path + a small `src/` relevance leaf (content). Enumerated
  precisely **at diagnosis time**, not pre-committed.
- **Tests added/edited:** conditional; any relevance-gate leaf gets its own AC-0 grep
  test; existing-test edits **adjudicated at build time** (none pre-authorized).
- **Gate:** the diagnosis written to `S3-DIAGNOSIS.md` (content-vs-instrument verdict +
  convicted layer + evidence) BEFORE the fix; then the fix's own unit/live checks.
- **Commit stubs:** `inc3b S3-diagnose: root-cause [content|instrument] conviction with
  evidence (NOT a pre-chosen fix)` then `inc3b S3-fix: <convicted-layer> fix + riders`.

### S4 — read-gate #2 + re-roll evidence + ride-along captures → Max UAT

Re-run AC-READ (same frozen S0 thresholds) after S3 (or directly after S2 if S2 passed).
Then:
- **AC-REROLL evidence:** a seed-sweep draw/population diff harness (population-sweep
  pattern) over **3 macroSeeds on Moon/Mercury + 2 Frozen radius draws**, exercising
  `drawPresetRadius(..., { labUnlock:true })`. Assert: layout + largest-basin diameter
  differ across Moon/Mercury macroSeeds; radius draws land in `[0.27,0.38]` and vary;
  Frozen g-mediated deltas differ across radius draws. **State stamped-count
  R-invariance as a mesh-floor instrument limit — NOT sold as variety.**
  - **Drive the RIGHT control (lens-log m-4).** "Layout varies on Moon/Mercury" needs
    **`newPlanet()`** (the 🌍 **"new planet (re-roll all)"** button, `world-engine-lab.html:3871`)
    — it re-rolls `worldSeed → macroSeed` (`:3874`, `'draw:macro:'+worldSeed`), which drives
    crater placement via `forEachCrater(cond, macroSeed, …)` (`bombardment.js:305`). It does
    **NOT** mean **`rerollRadius()`** (the 🎲 button, `:3861`), which bumps only `radiusSeed` —
    a **no-op for layout**, and (pre-R3) a no-op for canonical-locked Moon/Mercury radius too.
    The harness sweeps `macroSeed`; the UAT recipe must name the **🌍 "new planet"** control,
    not 🎲 "reroll radius" (driving 🎲 on Moon/Mercury shows zero layout variety — re-triggering
    Max's "they do not vary"). Radius variety (R3) rides `newPlanet`'s `radiusSeed` redraw
    under `labUnlock:true`.
  - **Quantify the largest-basin spread, don't assert it (lens-log m-5).** With ~147 draws
    from a truncated Pareto, the max basin often pins near the `D_HI` truncation, so
    "largest-basin diameter differs across macroSeeds" may be a **weak** signal. S0/S4 compute
    the **expected max-basin spread across macroSeeds** (a few lines: sample the truncated SFD)
    and state it; if the spread is below a just-noticeable threshold, AC-REROLL rests on
    **layout** variety (which is robust) and reports biggest-basin variety as measured, not
    promised.
- **AC-MARS / ride-along captures:** Mars + Crystal **before/after** at the staged light,
  committed to `evidence/`, in the UAT packet — **presented, never silently shipped
  (R1)**. Mars `f_I` asserted `∈[0.3,0.8]`.
- **AC-FROZEN honest finding:** write the near-Moon/Mercury statistical finding to
  BUILD-NOTES with the numbers (R-invariant stamped population, near-equal g; distinctness
  this increment = iceness-term endo substrate + palette; ice-D_t + ejecta deferred).
- **UAT recipe (pinned):** the exact staged sun az/el (S0), Moon/Mercury + Frozen presets,
  re-roll, Mars/Crystal ride-along, **full-phase control capture reviewed as the honest
  pre-albedo state** (R2). Ping Max only after the gate is recorded.

- **Files touched:** NEW `calibration/inc3b-reroll-sweep.mjs`, `evidence/*`,
  `BUILD-NOTES.md`, `S4-VERDICT.md` + the UAT packet.
- **Tests added/edited:** the reroll-sweep is its own runnable harness; no golden
  re-capture. Any headless AC-REROLL assert lands as a NEW test file.
- **Gate:** AC-READ #2 recorded; AC-REROLL + AC-MARS evidence committed; BUILD-NOTES
  finding filed; UAT packet assembled → `VERIFIED_PENDING_MAX <sha>`.
- **Commit stub:** `inc3b S4: read-gate #2 + re-roll sweep evidence + Mars/Crystal/Frozen
  ride-along captures + honest Frozen≈Moon/Mercury finding → Max UAT (lighting-pinned recipe)`.

---

## (2) AC MAP — every contract AC → closing slice → verify command

| AC | Layer | Closed by | Verify command / observable |
|---|---|---|---|
| **AC-0** (spine conformance) | unit | S1 (+S3 if fires) | `npx vitest run tests/worldengine-inc3b-relief-budget.test.js tests/worldengine-v2-3-dispatch-oracle.test.js` + grep audit of `reliefBudget.js` for label/archetype-string routing and any `craters.rendersOn` name-add. Observable: guards green; zero label/archetype reads; `planet-feature-associations.js:74` unmodified; no new `*Enabled` keys. |
| **AC-BUDGET** | unit | S0 (harness) + S1 (wiring) | `node calibration/inc3b-amplitude-budget.mjs 40000 1` with budget applied. Observable: `f_I` in the S0.1a **anchor-swept** band; crater:base variance inverted to crater-dominant; total composite RMS = pre-budget within the **S0.2a-frozen variance definition + tolerance** (the closed-form solve, model-f_I ÷ realized-norm split, `V_cf<ε` identity clamp — §6-T2/S0.2a). |
| **AC-FENCE** | unit | S1 | `npx vitest run tests/v2-0-byte-identity.test.js tests/worldengine-v2-5-preset-composite.test.js` + full `npx vitest run` from repo dir. Observable: 75 goldens green (no re-capture); `despunRef` equality green; carrier hashes unchanged; suite at the 4-failure baseline; zero assertion edits. |
| **AC-IDENTITY** | unit | S1 | `npx vitest run tests/worldengine-inc3b-composite-budget.test.js` (Rocky/Ocean carriers pre/post). Observable: composited arrays byte-identical; weights asserted **exactly 1.0** on the identity path. |
| **AC-NULLPATH** | unit | S1 | same harness, null-path enumeration (Jovian…Venus/Magma/Carbon/Lava gate=n; Titan/Europa/Eyeball gate=Y nStamp=0). Observable: every world byte-identical; domain predicate excludes by condition scalar. |
| **AC-ORACLE** | unit | S1 | `npx vitest run tests/worldengine-v2-3-dispatch-oracle.test.js` + oracle grep. Observable: oracle green; denylist unchanged. **Fence is the :569 attach expression + leaf symbol name (S1.2a/M1), NOT the leaf file** — the oracle slices the writeBodyRelief condition block, which contains :569 but not `reliefBudget.js`; leaf label-freedom is AC-0's grep, a separate check. |
| **AC-FROZEN** | unit | S1 (byte) + S4 (finding) | `npx vitest run tests/v2-0-byte-identity.test.js` (Frozen 5 rows via `despunRef`) + the Frozen composite variance measurement + BUILD-NOTES finding. Observable: golden HEIGHT byte-identical; Frozen composite crater-dominated; near-Moon/Mercury finding filed with numbers. |
| **AC-READ** | integration (live) | S2 (flip) → re-run S4 | Working-Claude CDP drive at staged oblique light on the live vite port, seed 1 + 2 re-rolls, thresholds read from the frozen S0 JSON. Observable: arc (S0.5a distribution-tail bar) / **blind read = N≥3 captions + forced-choice (m-6)** / surface-class vs **relief-dominated reference (shaded-relief DEM or Mimas — MF-4)** bars recorded; full-phase control filed; verdict recorded either way; evidence in `evidence/`. |
| **AC-REROLL** | integration (headless) | S4 | `node calibration/inc3b-reroll-sweep.mjs` (3 macroSeeds M/M via the 🌍 **newPlanet** path — NOT 🎲 reroll-radius, m-4 — + 2 Frozen radius draws, `labUnlock:true`). Observable: layout differs across M/M **macroSeeds**; largest-basin spread **quantified** (m-5, reported measured not promised); radius draws in `[0.27,0.38]` and vary; Frozen g-deltas differ; stamped-count R-invariance stated (not sold as variety). |
| **AC-MARS** | integration (live) | S4 | Working-Claude CDP capturing Mars + Crystal before/after at staged light; files to `evidence/`; Mars `f_I` asserted `∈[0.3,0.8]`. Observable: before/after captures committed + in UAT packet; presented, not silently shipped. |
| **AC-UAT** | uat | Max alone (S4 packet) | Max drives the lab solo on the live vite port with the pinned oblique-light recipe. Observable: Max's holistic acceptance. **No agent closes this** — the verify workflow marks it `deferred-to-max`. |

---

## (3) RISK REGISTER (brief §4 + the seam findings) — with mitigations

- **R1 — "Sparsely dimpled Rhea," not "heavily cratered Moon."** ~147 complex-rolled
  dishes with a texture void `<133 km`. **Mitigation:** S2 gates the flip alone first; if
  it texture-fails, S3's diagnose-first convicts content-vs-instrument before any fix —
  peppering is not assumed. The gate's verdict is the measured justification either way.
- **R2 — Bake attenuation may eat the 1-edge crater walls harder than modeled.**
  S0.5's model is a prediction, not a guarantee. **Mitigation:** the arc signal is a
  frozen S0 threshold; if S2 under-delivers, S3's instrument branch convicts bake/posterize
  and fixes at that layer (R4 explicitly allows rendering-scale fixes).
- **R3 — Lighting freedom exposes the near-featureless full-phase view.** **Mitigation:**
  R2 accepted (Max) — the UAT recipe pins oblique light AND files the full-phase control
  as the honest pre-albedo state; albedo/ejecta fenced to the exogenic increment.
- **R4 — Frozen still reads "same world, different palette" this increment.** True by
  measured population statistics. **Mitigation:** AC-FROZEN tells Max up front with the
  numbers; ice-D_t + bright-rim/ejecta are the deferred real differentiators.
- **R5 — Re-roll variety may still feel subtle** (layout + biggest basin + radius only).
  **Mitigation:** AC-REROLL states the R-invariance honestly; figure/limb re-roll is its
  own scoped increment only if S4's variety AC fails.
- **R6 — Calibration honesty:** the Λ anchors privilege Mercury/Moon; real-body RMS values
  are training-sourced. **Mitigation:** S0 scripts cite them as medium-confidence; a
  literature-verify pass is available if Max wants it.
- **R7 — The AC-BUDGET harness does not exist in the tree (§0.9).** **Mitigation:** S0
  authors + commits `calibration/inc3b-amplitude-budget.mjs`, reproducing the `~1.14%`
  pre-budget ratio as its self-check before the budget is wired; AC-BUDGET verifies
  against the committed harness, not an ephemeral scratchpad.
- **R8 — RMS-preservation exactness vs leaf purity (§6-T2).** A calibration-honesty +
  determinism tension, not a blocker. **Mitigation:** S0 adjudicates and FREEZES the
  normalization choice; AC-BUDGET's tolerance is set to match the frozen choice, with the
  reasoning in BUILD-NOTES.

---

## (4) ENV GOTCHAS — for the build session

- **Lab vite port is NOT pinned** — `vite.config.js` sets no `server.port`, so it uses
  the default 5173 and **auto-increments to 5174/5175… when 5173 is occupied** (the
  concurrent-lanes memory noted `:5174` for exactly this reason). **Discover the live
  port at drive time via `mcp__chrome-devtools__list_pages`** — do NOT `curl` localhost
  (sandbox returns `000`/refused for un-allowlisted ports; `feedback_sandbox-localhost-probe`),
  and do NOT start the server yourself (`feedback_no-start-servers` — the hook blocks
  `vite`; tell Max the exact command + URL to run in his WSL terminal).
- **NOT-OURS files — NEVER staged, NEVER touched:** `src/auto/CameraChoreographer.js`
  and `src/debug/LabMode.js` (both show `M` in the working tree at HEAD). Stage **named
  files only** — never `git add -A`/`git add .` (the repo root also carries ~30 untracked
  PNGs).
- **vitest runs from the repo dir only** (`/home/ax/projects/well-dipper`).
- **Full-suite baseline = 4 known failures** (KnownObjects ×3 + GalacticFeatures ×1) +
  vendor/motion-test-kit collection noise — never "fixed," never grown. New test files are
  all-green additions.
- **Goldens NEVER re-captured** — `v2-0-carrier-goldens.json` is immutable; Frozen's 5
  rows ride the `despunRef` reconstruction, not a capture.
- **Atmo-owned sections of `world-engine-lab.html`** (section-ownership fence) — untouched.
  The relief/render edits touch only the composite seam (S1) and, conditionally, the
  crater/relevance/bake path (S3); leave the F27–F30 storm block, `mulberry32`, F29/F43
  atmo/crystal blocks alone.
- **chrome-devtools window hygiene** — one reused context per agent; close pages after
  each browser-verifying drive (`feedback_agent-browser-window-hygiene`).
- **No headless `claude -p`** in the calibration/harness scripts (pure `node` only;
  `feedback_flag-headless-cost`).

---

## (5) HARD-CONSTRAINT CHECKLIST (contract — violating any is NEEDS-FIX)

- [ ] Total composite RMS preserved (reallocation, NOT physicalization); outside the
      domain predicate `w_e=w_i=1.0` **BIT-EXACT** (asserted, not assumed).
- [ ] Frozen 5/5 golden HEIGHT rows + `despunRef` equality byte-identical, **no
      re-capture**; `carrier.height` never mutated; `craterField` stays its own channel;
      dispatch-oracle grep untripped (`reliefBudget.js` reads condition/derived scalars only).
- [ ] Read-gate thresholds derived in S0 and FROZEN before the first capture; no post-hoc
      tuning.
- [ ] No taste constants anywhere — every number carries a derivation + anchor (or is
      explicitly flagged GUESSED with a resolution path).
- [ ] R3: only Moon/Mercury unlocks (opt-in, LAB-only); `[0.27,0.38]` entry does not
      disturb other presets' draws; headless/test paths keep canonical radius (Moon/Mercury
      **stays** in `NAMED_BODY`; the flagless callers are unchanged — verified §0.4).
- [ ] `craterField.height` (carrier) never mutated; the budget is composite-side only.
- [ ] Full vitest at the 4-failure baseline, not grown; zero edited/relaxed assertions.

---

## (6) OPEN TENSIONS FOR THE LENS PASS (surfaced, not resolved)

> Per the task: report contract/brief tension, do not silently resolve it. These three
> are for the byte-safety + mechanism lens pass (and Max) to rule on before the build.

**T1 — R3 "removed from the NAMED_BODY lock (driver-presets.js:239)" vs "headless/test
paths keep canonical radius."** These are in **direct conflict** under a literal reading
(§0.4): (a) Moon/Mercury is archetype-null, so deleting it from the Set at :239 does not
even produce a draw — it needs its own range entry; (b) `population-sweep.mjs:162` and
`frozen-ice-trace.mjs:49/63` call `drawPresetRadius(name, s)` and **rely** on the
`NAMED_BODY.has → canonical` branch — a literal Set-removal disturbs headless calibration
(and the contract's claim "headless… passes canonical radii explicitly" is false for
these two). **Recommended resolution (specced in S1.5):** keep Moon/Mercury **in**
`NAMED_BODY`; add a LAB-only opt-in `labUnlock` param + a dedicated `LAB_UNLOCKED_RANGES`
entry; only the lab draw site (:2984) opts in. This honors the **spirit** ("unlocked for
the LAB draw only") and the **hard constraint** exactly, while keeping
`worldengine-v2-6-drawlaw.test.js:41` and both headless harnesses byte-unchanged with
**zero test edits**. The literal contract wording ("removed from the NAMED_BODY lock at
:239") is not implementable without violating the hard constraint — flagging for Max's OK
on the spirit-over-letter reading.

> **LENS RULING (§7):** BOTH lenses independently CONFIRMED T1 — the literal Set-removal is
> byte-**unsafe** (`v2-6 population-sweep.mjs:129` added to the reliant-caller set, M4); the
> LAB-only opt-in is byte-safe and adopted. **Still needs Max's spirit-over-letter OK.**

**T2 — Normalization: closed-form determinism vs exact total-RMS preservation.** The
contract wants three things that mildly conflict: (a) `reliefBudget.js` a **pure
condition-scalar leaf** (AC-0 — so it cannot read the realized carrier arrays); (b)
**closed-form schedule statistics preferred** (S0 designDecision, for determinism); (c)
**total composite RMS unchanged within float tolerance** (AC-BUDGET). Closed-form `σ`
estimates won't preserve realized total RMS to float-epsilon — only to a **modeling
tolerance**. Two clean resolutions for S0 to pick and FREEZE:
  - **(i) Closed-form everywhere** — `reliefBudget.js` emits `w_e/w_i` from schedule
    stats; `compositeMargins` applies them; AC-BUDGET's tolerance is a stated **modeling**
    tolerance (not float-epsilon), justified in BUILD-NOTES. Cleanest leaf purity;
    approximate RMS.
  - **(ii) Split** — `reliefBudget.js` emits the **ratio target `f_I`** (pure,
    condition-derived, deterministic); the final RMS-preserving scale is solved **inside
    `compositeMargins`** from the realized channel norms (it already reads the arrays to
    sum them — no new fence issue, no mutation). Gives **exact** RMS preservation while
    keeping the leaf pure; the only cost is a deterministic variance pass over the arrays
    (reproducible, same as the goldens). **My recommendation is (ii)** — it makes
    AC-BUDGET's "within float tolerance" literally true and keeps the leaf a condition
    function; but it is the mechanism lens's call, so I am flagging not deciding.

> **LENS RULING (§7):** the mechanism lens took the call — **option (ii) is ADOPTED**, and the
> byte-safety lens confirmed it is byte-safe *provided* `compositeMargins` runs the literal
> `h+sd+cf` loop on `!inDomain` (now mandated, S1.3/m-7). Option (ii)'s realized-norm scale
> pass is exactly where MF-1's degeneracies live, so it is adopted **with the S0.2a guards
> bolted on**: model-`f_I` ÷ realized-norm split (else identity-collapse), the frozen variance
> definition, the `V_cf<ε` identity clamp, and the measured `Cov(h,cf)`. Resolution is (ii)+S0.2a,
> not bare (ii).

**T3 — Minor: `statusNote` HEAD (`041d7a8`) is stale.** The tree is at `4269689` (Inc-3
shipped). The brief's cited line numbers were captured at `041d7a8`; all re-verified to
their HEAD locations in §0 (e.g. `uCraterDensity` :5952 exact, `uPerturb` :5606 exact,
`compositeMargins` :210/:1322 exact). The contract's "v2-5 composite suite, 9 blocks" is
now **11** `it`/`describe` combined in the file — a transient count, not load-bearing.
No action needed beyond noting HEAD.

---

## (7) LENS LOG — adversarial pass, verified against HEAD `4269689` and folded

> Two lenses ran against this draft: **byte-safety/fence (A)** and **mechanism (B)**. The
> reviser re-verified every must-fix against the repo (file:line, and the MF-1 algebra by
> running it) **before** folding — nothing was applied on the lens's say-so alone. Verdict
> after revision: both lenses' load-bearing findings are folded; **no must-fix was rebutted**
> (all four verified valid); two — MF-2, MF-4 — were folded with a **narrowed** resolution
> the reviser judged more accurate than the lens's exact prescription (noted per-row).

### Lens verdicts (as received)
- **A (byte-safety):** BUILD-READY — could not construct a byte-safety violation the plan
  permits; every fence attack blocked by a specced mechanism. Minors M1–M6 (guards/completeness).
- **B (mechanism):** NEEDS-FIX — four defects that, if built as specced, would freeze
  un-derived numbers (MF-1/MF-2), presuppose S3's answer (MF-3), or leave an AC unverifiable
  (MF-4). Minors m-1–m-8. Confirmed the plan's own T1/T2 tensions.

### Mechanism must-fixes (B) — verification + resolution

| # | Reviser verdict (evidence) | Resolution folded |
|---|---|---|
| **MF-1** — w_e/w_i solve never written down; variance def / independence / V_cf→0 all missing | **CONFIRMED.** Ran the algebra this session: closed form `w_e²=(V_h+V_cf)/(V_h(1+r))`, `w_i²=r·w_e²·V_h/V_cf` reproduces `w_e=0.1732`, `w_i=86.48`, RMS-preserve **exact** (1e-12); identity-collapse `w_e²=1.0` exact when `r:=V_cf/V_h`; `V_cf→0` blows `w_i` to 9.5e4 at 1e-12. All of B's numbers reproduce. | **S0.2a** written: the explicit solve, the frozen **variance definition** (about-mean vs raw), the **model-`f_I` ÷ realized-norm split** as load-bearing (else identity-collapse), the **`V_cf<ε` identity clamp**, and the **measured `Cov(h,cf)`**. AC-BUDGET row + §6-T2 point at it. |
| **MF-2** — arc bar smuggles taste constants ("≥70% of ≥-median stamps") as model-derived | **CONFIRMED, narrowed.** Only the `≥1-band` magnitude is a bake-model output; `70%` (population fraction) + `median` (size gate) are acceptance conventions no line of the attenuation model emits. Under the no-taste-constant constraint they must be justified or flagged GUESSED. B also right that a 256²-cube 1.11° wall has sub-texel phase → attenuation is a distribution, so the band threshold belongs on the tail, not the mean. **Narrowing:** the constraint permits "flagged GUESSED w/ resolution path," so the fix is *un-smuggle* (justify statistically OR tag GUESSED), not *derive 70% from physics*. | **S0.5a** splits the bar: `≥1-band` = model-derived, set on the **distribution tail**, frozen; `70%`+`median` = each carries a **binomial-power justification OR a GUESSED tag + resolution path**, inline in `read-gate-thresholds.json`. |
| **MF-3** — S3 tree convicts by check-order, not data; can't discriminate the mesh-floor case | **CONFIRMED.** Verified the overlap in-repo: `craterSchedule` always returns `nStamp=104–147` (never routes to "sparse"); the brief lists "mesh density N" as **instrument** while "sub-mesh population absent" is **content** — the same mesh floor, claimable both ways. The draft even wrote "content-adjacent instrument limit." Order-dependent conviction is exactly R4's forbidden presupposition. | **S3.a** replaced with a **geometric inequality**: `θ_wall ≥ θ_floor` (S0's resolvable wall floor) & weak render → **instrument**; `θ_wall < θ_floor` → **content**. Mesh-floor lands on one side by the inequality; conviction reported as a measured deficit-split. |
| **MF-4** — AC-READ(iii) matches pre-albedo render vs albedo-bearing photo | **CONFIRMED, narrowed.** R2 (verified in contract) makes the render relief-only; the shared dither pipeline does not strip a Moon photo's maria/rays → confounded (toothless or biased). **Narrowing:** the contract AC *already* offers "Cassini Mimas class" (near-albedo-uniform), so the AC is satisfiable as written by choosing the relief-dominated reference — this is a *pin-the-reference* fix, not an AC defect. | **S2 (iii)** pins a **relief-dominated reference** — LRO/LOLA **shaded-relief DEM at matched sun az/el**, or **Mimas**; verdict read off **relief structure**; if a full-albedo photo is used, S0 **bounds** the contamination. AC-READ row updated. |

### Byte-safety minors (A) — verification + disposition

- **M1** (reframe AC-ORACLE fence) — **CONFIRMED & folded (S1.2a).** Verified the oracle slices `writeBodyRelief`'s `if (bodyDrivers?.condition){…}` block (`:259→block()`), which **contains the :569 attach line** but not `reliefBudget.js`. So the real fence = attach-expression + leaf-symbol-name token-cleanliness; leaf label-freedom is AC-0's separate grep. AC-ORACLE row corrected.
- **M2** (leaf must be total) — **CONFIRMED & folded (S1.1a).** `deriveReliefBudget` runs at :569 on every `writeBodyRelief` (golden harness, oracle, ~40 suites); a throw cascades RED. Mandated short-circuit-to-IDENTITY before any `0/0`; finite on all 18 presets; never throws.
- **M3** (two route()-body scanners omitted) — **CONFIRMED & folded (§0.8, S1 tests+gates).** `relief-router-repoint.test.js` + `relief-height-cube.test.js` exist and pin `marginHeight`/`marginGrad`/`bakeHeightCube` — none pin `compositeMargins` arity; listed NO EDIT (verified), run at S1 seam.
- **M4** (v2-6 `population-sweep.mjs:129` omitted from caller table) — **CONFIRMED & folded (§0.4).** Grep-confirmed the caller; harmless under opt-in but reliant on `NAMED_BODY.has→canonical`, same T1 argument. Added.
- **M5** (miscount 7→8 calls) — **CONFIRMED & folded (§0.1).** 8 calls (lines 99,104,108,114,122,129,136,140) → 9 callers. Corrected; all one-arg → IDENTITY so harmless, but the fence enumeration is now exact.
- **M6** (T3 counts) — cosmetic; already handled by §6-T3 ("11 blocks").

### Mechanism minors (B) — verification + disposition

- **m-1** (2-anchor fit un-validatable; f_I anchor-sensitive) — **CONFIRMED & folded (S0.1a):** ±20%/×2 anchor sweep, f_I band derived wide enough to absorb the medium-confidence anchor uncertainty.
- **m-2** (F2/Frozen render-path asymmetry) — **CONFIRMED & folded (§0.5):** verified `craters.rendersOn` (:74) contains Frozen+Mars but not Moon/Mercury → S0/S2 audit whether F2 fires by default in the baked branch and reconcile (no rendersOn edit).
- **m-3** (§0 never cited shelfDepth alloc on the despun path) — **CONFIRMED & folded (§0.1):** cited universal allocation (`substrate.js:17/19`, `sphereField.js:20/22`); Moon/Mercury reaches non-null via populated `craterField` while `shelfDepth` stays zero.
- **m-4** (AC-REROLL two-button ambiguity) — **CONFIRMED & folded (S4 + AC-REROLL row):** `newPlanet()` (:3871→:3874) re-rolls macroSeed=layout; `rerollRadius()` (:3861) bumps radiusSeed only. Harness+UAT name the 🌍 control.
- **m-5** (largest-basin variety may be near-invariant) — **CONFIRMED-plausible & folded (S4):** quantify expected max-basin spread from the truncated SFD; report measured, rest AC-REROLL on robust layout variety.
- **m-6** (blind-read single-agent coin flip) — **CONFIRMED & folded (S2 (ii)):** N≥3 captions + forced-choice against distractors.
- **m-7** (byte-exact identity path should be mandated) — **CONFIRMED & folded (S1.3):** `!inDomain` branch reduces to the literal `h+sd+cf` op order (AC-IDENTITY provable by inspection).
- **m-8** (T3 counts) — cosmetic; §6-T3.

### Tensions (both lenses concurred)
- **T1** (R3 literal Set-removal) — both CONFIRMED byte-**unsafe**; LAB-only opt-in adopted (S1.5). **Still needs Max's spirit-over-letter OK** (§6-T1).
- **T2** (normalization) — mechanism lens's call: **(ii)+S0.2a adopted** (§6-T2); byte-safe given the literal `!inDomain` loop (S1.3).

### Rebuttals
**None.** All four must-fixes verified valid against the repo. MF-2 and MF-4 were folded with a
narrowed resolution (permit GUESSED-with-path for MF-2; pin the already-offered Mimas/DEM
reference for MF-4) — recorded above so the narrowing is auditable, not silent.

---

*Draft by working-Claude (drafter role), 2026-07-23, against HEAD `4269689`. **Revised by
working-Claude (reviser role), 2026-07-23** — byte-safety + mechanism lens verdicts verified
against the repo and folded (§7). Feeds → sliced S0–S4 build in a fresh session.*
