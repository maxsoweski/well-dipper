# V2-5 BUILD-PLAN — Bombardment (exogenic crater-population host)

**Workstream:** `world-engine-v2-5-bombardment-2026-07-17` · **Plan written:** 2026-07-17
**Branch:** `feature/world-engine-production-L1` @ `3656795` · **Builds in the MAIN checkout** (`~/projects/well-dipper`, L1), concurrent with the atmo→L1 merge (atmo touches ONLY storm sections F24-F31 + `climateE5:*`/`stormE:*` writers + planet-archetypes F27-F29 provenance rows — disjoint from every symbol here).
**Binds to:** `contract.json` (9 ACs + 8 designDecisions BINDING; the six interview rulings in `statusNote` are SETTLED — not re-litigated) + `intent.md` + `~/briefings/grounding-v2-5-bombardment-2026-07-17.md`.
**Mold:** `world-engine-v2-4-substrate-2026-07-14/` (BUILD-PLAN §0 seam + shelfDepth own-channel pattern) — the crater host is the sixth editor-on-host exemplar, built with the identical byte discipline.
**Anchoring convention:** SYMBOLS, never line numbers (the atmo merge may shift lines). Every anchor below is a function/const/export name verified against live source 2026-07-17.
**Deviations from this plan are recorded in `## §10 Build deviations`, never silent.**

---

## §0 — Global invariants (apply to EVERY slice)

**Byte regime (LANDMINE #1 — CRATER LAYER, NOT HEIGHT).** `HASHED_FIELDS = ['height','grainAngle','grainMag','regime','faultDensity']`. The 75-golden (`tests/v2-0-byte-identity.test.js`, fixtures `tests/fixtures/v2-0-carrier-goldens.json`, captured `7441c92`, **NEVER re-captured**) iterates **exactly `Object.keys(PRESET_ARCHETYPE)` = 15 presets × SEEDS `[1,2,3,7,42]`** (verified: `v2-0-carrier-golden.mjs` `computeAllHashes` loops `Object.keys(PRESET_ARCHETYPE)`), hashing only those five fields, and calls `writeBodyRelief` **directly** (bypasses `route()`). **Three mechanical facts make every V2-5 write byte-inert:** (1) `craterField` is a NEW typed array outside `HASHED_FIELDS` — the goldens and the lid byte-anchors (`worldengine-lid-byte-anchors.test.js`, which read *named* arrays) never compare it; (2) the writer draws a NEW `alea('bombard:'+seed)` stream — `alea` streams are independent by seed-string, so it cannot perturb any existing `'plates:*'`/`'shell:*'`/`'stagnant:*'`/`'magma:*'`/`'e1:*'`/`'margin:'`/`'province:'` sequence; (3) the render composite lives in `route()`, which the goldens bypass. Byte-identity breaks ONLY by writing a hashed field or reordering an existing stream — neither of which any slice does. **Any `carrier.height`/`HASHED_FIELDS` write on any golden preset is a HARD STOP, not adjudicable this increment.**

**New-preset byte-safety (LANDMINE #2) — and the two DRIVER_PRESETS-keyed guards it DOES touch.** The new `Moon/Mercury (impact-airless)` preset is added to `DRIVER_PRESETS` (`driver-presets.js`) but **NOT to `PRESET_ARCHETYPE`** — so the **75-golden carrier loop never sees it** (`computeAllHashes` iterates `Object.keys(PRESET_ARCHETYPE)`, and the goldens' `hashCarrier` iterates only `HASHED_FIELDS` — `craterField` invisible, `carrier-goldens.json` byte-frozen, NEVER re-captured). It routes dead-lid through the EXISTING derived dispatch (§5 arithmetic) — **no new dispatch rule, no label routing, not added to the golden set.**

> **CORRECTION (byte-safety lens BS-MF1/BS-MF2 — FOLDED).** The Mars / Hot Jupiter precedent is NOT "in `DRIVER_PRESETS` and unswept." Mars + Hot Jupiter are **swept** — they are two of the 17 rows in the dispatch-oracle's `ADJUDICATION` table (`worldengine-v2-3-dispatch-oracle.test.js`, `NAMES17 = Object.keys(DRIVER_PRESETS)`); they are absent ONLY from `PRESET_ARCHETYPE` (the 75-golden). **Two guardrails key off `Object.keys(DRIVER_PRESETS)` and MUST get a code-level row/assertion edit when the 18th preset lands (SLICE 2):**
> 1. **`worldengine-v2-3-dispatch-oracle.test.js`** — `NAMES17` becomes 18; the module-level `const rows = NAMES17.map(name => ADJUDICATION[name].today)` (oracle:123) would throw `TypeError` (missing key) at collection and **crash the whole file** unless an `ADJUDICATION` row is added. Also fails: `NAMES17.length toBe(17)` (:132), the `NAMES17 ⇄ ADJUDICATION` key-set equality (:135), `equal.length toBe(15)` (:154), and the seed-invariance loop reading `ADJUDICATION[name].derived` (:172).
> 2. **`v2-0-slice-a-byte-safety.test.js`** — `Object.keys(DRIVER_PRESETS).length toBe(17)` (:31) and the whole-object `toEqual(DP_SNAPSHOT)` deep-equal (:41, against `v2-0-driver-presets.ad156cc.json`) both fail. (`PRESET_NAMES === Object.keys(DRIVER_PRESETS)` at :38 STAYS green — `PRESET_NAMES` is defined as `Object.keys(DRIVER_PRESETS)`, driver-presets.js:171.)
>
> These are **code-level table/assertion edits mirroring how Mars + Hot Jupiter joined the oracle at V2-3** — NOT a carrier-golden re-capture, NOT a fixture re-capture. `v2-0-carrier-goldens.json` and `v2-0-driver-presets.ad156cc.json` both stay **git-diff-empty** (the ad156cc pin's semantics — "the original 17 are unmutated" — is preserved by a per-key subset assertion; see SLICE 2). The exact edits are enumerated in §7 SLICE 2 and gated there.

**E1-blindness + shadow-audit (LANDMINE #4).** `worldengine-e1-shadow-audit.test.js` enumerates `readdirSync('src/worldengine/base')` and asserts every file except `e1Regime.js`/`lidResponse.js` references neither `computeE1` nor `import … e1Regime`. The new `src/worldengine/base/bombardment.js` is auto-enumerated and **passes by construction** (it imports only `mathutil.js`; reads only condition-vector scalars + its own `'bombard:'` field; never the E1 tuple, regime, or label) — a growth-by-enumeration PASS (the shadow-audit count ticks up by 1, exactly as V2-4's province/margins/figure modules each did). It **gates plate-vs-not the passiveMargins way — via a data predicate, never a regime read** (§3).

**Guardrail quartet + oracle (LANDMINE #6, AC-ZERO-CLOBBER).** Split into two classes now that the preset lands (BS-MF1/BS-MF2 fold):
- **BYTE-UNCHANGED (no test edit):** `worldengine-e1-conformance-oracle.test.js` (`NAMES15` filter), `worldengine-e1-shadow-audit.test.js`, `worldengine-lid-router-audit.test.js` (hard-coded 6-file `BASE_WRITERS`, excludes bombardment.js), `worldengine-lid-byte-anchors.test.js` (named-array reads), `planet-archetypes.test.js` (no `*Enabled` key / no `FEATURES` entry added; `panelPresetKeys` only grows). These stay green with ZERO edits.
- **CODE-LEVEL ROW/ASSERTION EDIT (SLICE 2, adjudicated — the Mars/Hot-Jupiter-join precedent, NOT a re-capture):** `worldengine-v2-3-dispatch-oracle.test.js` (add the 18th `ADJUDICATION` row + count bumps) and `v2-0-slice-a-byte-safety.test.js` (count bump + per-key subset assertion). Both key off `Object.keys(DRIVER_PRESETS)`; see §0 CORRECTION above + §7 SLICE 2.

The dispatch-oracle's **label-free grep leg is untouched by the seam:** it balanced-brace-slices the `if (bodyDrivers?.condition)` block and **denies** `PRESET_ARCHETYPE`, `\.label\b`, `stagnantLidRegimeOf\s*\(`, `isVolcanicPath\s*\(`, `isEarthlikePlatePath\s*\(`, `\bshellRegimeOf\s*\(`, `\barchetype\b` while **requiring** `computeE1(` + `compositionClass`. The one seam line added inside that block — `writeBombardment(carrier, cond, { macroSeed });` — contains NONE of the denied tokens (verified against the grep source) and leaves both required anchors intact. (The `ADJUDICATION`-row edit is in the TEST file, not the dispatch source the grep reads.)

**Atmo fence.** V2-5 NEVER edits `climate-e5.js`, `emission-e.js`, the storm/band sections of the render mega-files, `planet-lod-uniforms.js` storm blocks, or the atmo-shared planet vertex/fragment shader (`aBand`/`aShear`/`aMush`). No new render attribute is added to the shared planet BufferGeometry (§4 render is displacement-only, no albedo attribute). Atmo suites (`worldengine-base-climate-e5`, `worldengine-base-emission-e`) pass unchanged. The atmo→L1 merge and this workstream are symbol-disjoint.

**Legacy F2/F3 untouched (LANDMINE #5).** The in-shader `craterCombiner()`/`ejectaCombiner()`/`craterProfile()` in `planet-lod-height.glsl.js`, the `uCrater*`/`uEjecta*` uniforms, and the lab state keys `craterDensity`/`craterSizeKm`/`cratersEnabled`/`ejectaEnabled` (in the `clash` toggle group) are **not edited or removed.** Their `FEATURES.craters`/`FEATURES.ejecta` entries keep their existing classification (no `provenance` field = legacy placeholder). The new writer registers its `✦ current` provenance WITHOUT a new `FEATURES` entry (§6).

**Not-ours dirty files.** `src/auto/CameraChoreographer.js`, `src/debug/LabMode.js` are excluded from every commit (`git add` only the explicit fenced paths; verify `git show --stat`).

**Test discipline.** `npx vitest run` **FROM THE REPO DIR ONLY** (`cd ~/projects/well-dipper`). Calibration is pure `node` (`.mjs`) — metered-safe, no `claude -p`. Build agents commit NOTHING; working-Claude is the serialization point and commits at each slice boundary AFTER the AC-ZERO-CLOBBER gate is green.

---

## §1 — CHANNEL SHAPE (AC-CHANNEL, AC-0 ch.2)

**Decision: a NEW unhashed host channel `craterField`, following the `shelfDepth` precedent exactly.** A single **signed** `Float32Array(count)` on the carrier, composited by `route()` at render, never touching `carrier.height`.

**Allocation site (parity on BOTH carriers, the V2-4 pattern):**
- `src/worldengine/base/sphereField.js` `makeSphereField()` return literal gains `craterField: new Float32Array(count)`, slotted beside `shelfDepth`/`province` with the same comment idiom.
- `src/worldengine/base/substrate.js` `makeSubstrate()` gains the identical `craterField: new Float32Array(count)` (flat-grid twin parity — allocated for symmetry even though the writer runs on the sphere carrier only; §2 guards on `carrier.verts && carrier.adj`, the passiveMargins precedent).

**Layout / semantics.** `craterField[i]` = the crater-population displacement at node `i`, in the SAME normalized height units as `carrier.height`:
- **negative** inside a crater bowl (floor below the pre-impact datum),
- **positive** on the raised rim and the low ejecta apron,
- **zero** on un-cratered ground AND on every non-target body (idempotent `fill(0)` first).

**Why signed-single-field satisfies "host a later epoch edits" structurally.** The #6 epoch editor (floor-fractured craters; later mare-flooding) must (a) *find* basin floors and (b) *edit* them in place. A per-node signed field indexed by the same node index as `carrier.height` gives both: the editor thresholds `craterField[i] < FLOOR_CUT` to locate floors, then mutates `craterField` (raise floors → fractured-floor craters; deep-basin fill → maria) with the source `carrier.height` untouched — the exact editable-host contract shelfDepth proved. A per-basin `craterId` map is a documented **non-goal this increment** (basis-level bar; the thresholdable displacement host is sufficient for the #6 de-risk).

**Divergence from shelfDepth (justified):** shelfDepth is one-signed (a seaward lift); `craterField` is **two-signed** (bowl + rim) because a crater is a depression *and* a rim — this is required for the cratered silhouette to read (a bowl-only field would render as smooth pits, not craters). No other divergence: same dtype, same allocation site, same route-composite discipline, same "never `carrier.height`" rule.

**Named consumer (AC-0 ch.2):** `route()` composites `craterField` into the render height at sample time (§4) — the crater channel is documented in `BOMBARDMENT-MAP.md` (§7) as **the #6 editor's host** (editor-on-host exemplar).

**AC-CHANNEL splits into two resolution regimes (mechanism lens M-MF3 — FOLDED). The golden mesh is `TARGET_N = 700`** (`v2-0-carrier-golden.mjs:41`), where `meanEdgeAngle ≈ sqrt(4π/700) ≈ 0.134 rad ≈ 7.7°`, so `D_MAX_RAD ≈ 0.50 rad ≈ 3.7 nodes` and `D_MIN_RAD` is sub-node — **few or no craters resolve a bowl+rim (≥3 samples) at N=700**, so "variance > 0 AND both signs present" is FLAKY there and must NOT be asserted on the golden carrier. So:
- **At `TARGET_N = 700` (golden carrier, byte gate):** assert `craterField` present on both carriers, distinct object identity from `shelfDepth`/`maturity`, AND the full 75-golden `height` bytes byte-identical. (Non-triviality is NOT asserted here — it is resolution-dependent and would flake.)
- **At a representative render resolution (`N ≈ 40 000`, the lab mesh), OR by a direct `craterProfile` unit test:** assert **non-trivial** — `variance > 0` AND **both signs present** (bowl floor `< 0`, rim/ejecta `> 0`). The `craterProfile(s, D)` two-signed shape is unit-testable at the profile level independent of any mesh, giving a resolution-free non-triviality proof; the ≈40k carrier assertion is the integrated confirmation that stamped craters resolve.

---

## §2 — WRITER MODULE (AC-POWERLAW, AC-MULTIPLY, AC-DISTINCT, AC-0 ch.1)

**New file:** `src/worldengine/base/bombardment.js`. THREE-FREE, PURE, E1-BLIND. Imports only `./mathutil.js` (`clamp`/`clamp01`). Reads ONLY `condition.surfaceGravity`, `condition.age`, `condition.atmosphere`, `condition.T_eq`, `condition.rawTidalIoRatio` + `carrier.verts`/`carrier.adj` + its own `alea('bombard:'+seed)` stream. Writes ONLY `carrier.craterField`.

**SHADOW-AUDIT SUBSTRING TRAP (byte-safety lens BS-m1 — FOLDED). `bombardment.js` must contain ZERO `computeE1` and ZERO `e1Regime` substrings — INCLUDING in comments.** `worldengine-e1-shadow-audit.test.js:49` is a raw `src.includes('computeE1')` with **no comment stripping**, and :50 is `/from\s+['"][^'"]*e1Regime/` (import-form). A build agent writing a header comment like `// never calls computeE1` or `// E1-blind (see e1Regime.js)` would trip :49 (bare `computeE1` substring) — a spurious RED. Describe the E1-blindness discipline WITHOUT ever typing those two tokens (e.g. "reads no geodynamic tuple / regime / label," "no derived-dispatch import").

```
export function writeBombardment(carrier, condition, { macroSeed = 0 } = {}) { … }
```

### 2a — Seeded crater population (per-seed determinism)
- `carrier.craterField.fill(0)` first (idempotent; guarantees all-zero on non-targets and on re-run).
- Guard: `if (!carrier.verts || !carrier.adj) return carrier;` (sphere-only, the passiveMargins guard).
- Self-gate (§3 predicate) — if not an impact surface, return with the field all-zero.
- `const rng = alea('bombard:' + (macroSeed | 0));` — the ONLY entropy source; fixed draw order (per crater: center-node pick → diameter draw → depth jitter). Prefix-disjoint from every existing namespace.
- `nCraters` = the MULTIPLY-scheduled count (§2c). Loop `nCraters` times:
  - **center:** `centerNode = floor(rng() * N)` (uniform node pick — resolution-independent placement).
  - **diameter:** `D = drawPowerLaw(rng)` (§2b) `× sizeMul` (§2c), in geodesic radians.
  - **stamp:** bounded multi-source-free BFS from `centerNode` over `carrier.adj` out to angular radius `D/2 + RIM_FRAC·D` (the ejecta-apron edge), accumulating `craterField[j] += craterProfile(s, D)` where `s` = geodesic angle from center to node `j` (via `dot(verts[centerNode], verts[j])` → `acos`). O(craters × affected-nodes), bounded (the `plates.js:317-334` / passiveMargins BFS idiom, queue drain, NEVER while-to-convergence).
- **`craterProfile(s, D)`** — a mesh-independent radial profile (geodesic **radians in**, **normalized-height out**), the resolution-independent trick passiveMargins uses. **The horizontal extent `s`/`D` is in radians; the vertical amplitude is in normalized-height units (same scale as `carrier.height`) — the two are DIFFERENT units and must not be conflated (mechanism lens M-m3 — FOLDED).** The vertical amplitude of a crater of angular diameter `D` is `A(D) = CRATER_DEPTH_N · (D / D_REF_RAD)^DEPTH_POW`, where `CRATER_DEPTH_N` is a **normalized-height** constant pinned by `crater-scale.mjs` against the actual despun height amplitude (the `MARGIN_LIFT_N = 0.1127` precedent), `D_REF_RAD` is a reference angular diameter, and `DEPTH_POW ∈ [0,1]` (sub-linear — big basins get deeper but not proportionally, the real `d/D` flattening). The profile scales OFF `A(D)`, never off raw `D`:
  - `0 ≤ s < 0.5·D·FLOOR_FRAC` : flat floor at `−A(D)` (simple-crater floor).
  - `0.5·D·FLOOR_FRAC ≤ s < 0.5·D` : bowl wall ramping floor → 0 at the rim crest.
  - `0.5·D ≤ s < 0.5·D + RIM_W·D` : raised rim, peak `+RIM_HEIGHT_FRAC · A(D)`, decaying to the ejecta apron.
  - `0.5·D + RIM_W·D ≤ s < 0.5·D + RIM_FRAC·D` : low ejecta apron `+EJECTA_FRAC · A(D)` decaying to 0.
  - Craters **superpose** (`+=`): younger overprints older, so overlapping stamps read as a battered surface (the correct Moon look, not disjoint pits).
  - **Legibility floor:** `crater-scale.mjs` asserts a `D_MAX_RAD` basin renders at `A(D_MAX) ≥ MIN_BASIN_DEPTH_N` (a documented minimum fraction of the despun amplitude), so giant basins are visible bowls, not shallow dimples (the vertical twin of the §4 shelf-lesson resolution check).

### 2b — Power-law size-frequency (DOCUMENTED slope band + the fit test)
- Cumulative size-frequency `N(>D) ∝ D^(−B_SFD)`, drawn by bounded-Pareto inverse-CDF over `[D_MIN_RAD, D_MAX_RAD]`:
  `D = D_MIN · (1 − u·(1 − (D_MIN/D_MAX)^B_SFD))^(−1/B_SFD)`, `u = rng()`.
- **Documented slope band:** `B_SFD` (cumulative exponent) target **2.0**, band **[1.8, 2.2]** — the lunar-highlands production-population range. Pinned by `crater-powerlaw.mjs` (§7).
- **The fit test uses the DIFFERENTIAL SFD, NOT the cumulative (mechanism lens M-MF1 — FOLDED).** The plan originally fit `log(N(>D))` vs `log(D)` (cumulative) and claimed a uniform-diameter null gives "a flat cumulative, slope ≈ 0." **That is false and would not reliably reject the null.** A bounded-uniform diameter population has cumulative `N(>D) = N·(D_MAX−D)/(D_MAX−D_MIN)` — *linear* in D, whose log-log local slope runs from `−D_MIN/(D_MAX−D_MIN) ≈ −0.1` at the small end to `−∞` near `D_MAX`; a least-squares line through it fits a *negative* slope of magnitude ~0.5–2 (binning-dependent), which can drift into or near `[−2.2,−1.8]` — the null is NOT decisively separated. (And `R²` on a monotone cumulative is a weak power-law discriminator.) **Fix — fit the differential `dN/dlogD` (raw counts per log-spaced bin):**
  - A true power-law `N(>D) ∝ D^(−B)` gives `dN/dlogD ∝ D^(−B)` ⇒ log-log slope **`−B ≈ −2.0`, band unchanged `[−2.2, −1.8]`** (the cumulative-exponent numerics carry over exactly for `dN/dlogD`).
  - A uniform-diameter null gives `dN/dlogD ∝ D^(+1)` ⇒ slope **`≈ +1`, robustly OUTSIDE the band** (a clean, sign-flipped separation — the whole point of switching).
  - *(Do NOT adopt the differential-per-`dD` convention `dN/dD ∝ D^(−B−1)` here — that would move the band to ≈`[−3.2,−2.8]` and the uniform null to ≈0. We use `dN/dlogD` so the pinned `[−2.2,−1.8]` band is preserved.)*
- **The exact test (AC-POWERLAW):** generate the population for the new preset across all five seeds; bin drawn diameters into log-spaced bins; compute `log10(dN/dlogD)` vs `log10(D)`; least-squares linear fit. **Assert:** slope ∈ **[−2.2, −1.8]** AND R² > **0.95** on every seed. **Uniform-null rejected:** the test also generates a uniform-diameter population and asserts its `dN/dlogD` fitted slope is **positive (≥ 0)** and outside `[−2.2,−1.8]`.
- **Calibration guard (sparse large-D bins):** `crater-powerlaw.mjs` PRINTS the actual fitted power-law slope + R² AND the fitted uniform-null slope + margin **on all 5 seeds BEFORE the thresholds are hard-coded** — the large-D bins are sparse at modest `N_CRATERS_REF`, so it must confirm `R² > 0.95` is genuinely met on the differential every seed (raise `N_CRATERS_REF` for the test population or widen the bin count if not).

### 2c — MULTIPLY scheduling (continuous, neutral mid-body reference)
The established MULTIPLY discipline (magmatism / V2-5s / plate / stagnant): `craterDensity` (count) and `craterSize` are **continuous functions** of gravity + age, `= 1` (neutral) at a **NAMED mid-body reference**.
- **Neutral reference (pinned by `crater-drivers.mjs`):** `G_REF = 0.5` g, `AGE_REF = 4.0` Gyr — a nominal mid dead-lid body (between Moon 0.165 g and Earth 1 g; between a fresh and a maximally-old surface). At `(g=G_REF, age=AGE_REF)` both multipliers are exactly 1.
- **Count:** `nCraters = round(N_CRATERS_REF · (age/AGE_REF)^K_AGE · (G_REF/g)^K_GD)`.
  - `K_AGE > 0` ⇒ **older → more** (longer exposure accumulates more impacts).
  - `K_GD > 0` on `(G_REF/g)` ⇒ **lower gravity → more** (weaker relaxation/retention on low-g airless bodies).
- **Size:** `sizeMul = (G_REF/g)^K_GS` ⇒ **lower gravity → larger** (gravity-regime crater scaling `D ∝ g^(−~0.17)`; `K_GS ≈ 0.17` is the physical exponent). **Weak-response caveat (mechanism lens M-m2 — FOLDED):** at `K_GS = 0.17` the individual-size multiplier spans only ~1.77× across the FULL `[0.1,3.0]` gravity slider and ~1.3× over a normal drag — a **weak secondary read**. AC-LAB's "visibly change size" legibility rides primarily on **count** (`(G_REF/g)^K_GD`, a much larger span), not on individual size. Boosting `K_GS` above the physical 0.17 purely for slider legibility is an **adjudicable Max taste call** (§9), NOT baked here.
- **Direction table (AC-MULTIPLY, monotone over the slider ranges):**

  | driver | count | individual size |
  |---|---|---|
  | ↓ gravity | ↑ (via `(G_REF/g)^K_GD`) | ↑ (via `(G_REF/g)^K_GS`) |
  | ↑ age | ↑ (via `(age/AGE_REF)^K_AGE`) | — (age drives count, not size) |

- **Reference constants** `N_CRATERS_REF`, `K_AGE`, `K_GD`, `K_GS` are the **output of `crater-drivers.mjs`** (§7), pinned BEFORE the writer is finalized.
- **AC-MULTIPLY is a DIRECT-WRITER-METRIC test (mechanism lens M-MF2 — FOLDED), NOT a full-route test.** Call `writeBombardment` on a carrier with a **synthetic condition vector** varying only `surfaceGravity` / `age` (fixed seed), and measure `craterField` count/size directly. This proves the writer FORMULA's monotonicity **independent of the base-route dispatch** — critical because plumbing the sliders into `condition.surfaceGravity`/`condition.age` (§6c) makes `computeE1`'s route driver-sensitive: over the slider ranges the base terrain writer flips dead-lid→stagnant-lid (§5/§6c crossover), but that flip does NOT touch `craterField` (the writer reads the condition scalars directly). Assertions:
  - **Monotone but NON-STRICT (mechanism lens M-m1 — FOLDED):** `nCraters = round(...)` is a staircase, so the count response has flat steps — assert `≤`/`≥` (monotone-non-decreasing / non-increasing), NOT strict `<`/`>`, and sample the sweep coarsely enough to clear a step. Same for `sizeMul` where `round`ing enters.
  - **Neutrality is a NORMALIZATION sanity check, not physical validation (mechanism lens M-m6 — FOLDED):** assert both multipliers `≈ 1` at `(G_REF, AGE_REF)` — but label it as confirming the formula's own normalization, NOT as an independent physical check.

### 2d — Distinct per draw (AC-DISTINCT)
- **Repeat-seed determinism:** two runs at the same `(preset, seed)` → `craterField` byte-equal (the writer greps no `Math.random`/`Date.now`; only `alea('bombard:'+seed)`).
- **Inter-seed difference:** seeds `[1,2,3,7,42]` give large pairwise field differences (per-node L2 distance well above the repeat-seed floor of 0).
- **(gravity, age) grid distinctness:** a small grid of `(g, age)` pairs yields visibly different populations (count and size both shift).

---

## §3 — GATING (label-free, E1-blind predicate)

**Decision: the channel is allocated UNIVERSALLY (every carrier) and the WRITER is called UNIVERSALLY (like `writeProvince`), but SELF-GATES to all-zero on non-targets via a condition-vector predicate.** Justification against shadow-audit: a universal call keeps the seam one line and matches the closest existing post-dispatch precedent (`writeProvince(carrier, {seed})`, universal); the writer reads ONLY condition scalars — never `e1.geodynamicRegime`, never a label — so the shadow-audit's E1-blind guard passes and the "gate plate-vs-not the passiveMargins way (a data predicate, not a regime read)" landmine is honored.

**The predicate — `isImpactSurface(condition)` (internal to `bombardment.js`, condition scalars ONLY):**
```
airless-or-thin :  !atmosphere || (atmosphere.pressure ?? 0) < CRATER_ATMO_MAX     // 0.05 bar
dead (no active resurfacing) :  (rawTidalIoRatio ?? 0) < CRATER_TIDAL_MAX          // 0.15
cold-enough (solid, not molten) :  (T_eq ?? 288) < CRATER_T_MAX                    // 450 K
fire  ⟺  airless-or-thin  AND  dead  AND  cold-enough
```
**Hand-verified selection across all 18 presets (condition scalars):**

| preset | atmo pressure | rawTidal | T_eq | fires? | why |
|---|---|---|---|---|---|
| **Frozen (airless)** | null | ~0 | 60 | **YES** | the "bumpy" answer |
| **Crystal (faceted)** | null | ~0 | 150 | **YES** | dead-lid icy despun |
| **Mars (arid rocky)** | 0.01 | ~0 | 210 | **YES** | thin-atmo dead rocky |
| **Moon/Mercury (new)** | null | ~0 | 235 | **YES** | the UAT target |
| Lava (hot airless) | null | >0.45 | 950 | no | tidal + T |
| Magma (K2-141b) | null | high | 2000 | no | tidal + T |
| Europa (icy moon) | null | ~137 | 110 | no | tidal (cryo-active) |
| Carbon (high C/O) | null | ~0 | 600 | no | T > 450 |
| Rocky / Ocean / Eyeball | ≥1.0 | — | — | no | atmosphere present |
| Venus | 92 | — | — | no | atmosphere present |
| Titan | 1.5 | — | — | no | atmosphere present |
| Gas×3 / Sub-Neptune / Hot Jupiter | 1000 | — | — | no | atmosphere present |

Result = four bodies fire: Frozen, **Crystal**, Mars, Moon/Mercury. **The predicate reads NO regime, NO composition class, NO label** — only `atmosphere.pressure`, `rawTidalIoRatio`, `T_eq` (all condition-vector scalars the dispatch itself already reads elsewhere, e.g. rule 3d). Constants `CRATER_ATMO_MAX`/`CRATER_TIDAL_MAX`/`CRATER_T_MAX` are sanity-checked by `crater-gate.mjs` printing the predicate value for all 18 presets.

**CRYSTAL SCOPE — SURFACED TO MAX (mechanism lens M-m5 — FOLDED as adjudicable, §9).** The contract `designDecisions[1]` names the overprint targets as "**Frozen + dead-lid rocky (Mars-class)**." The data-driven gate ALSO fires on **Crystal (faceted)** — it is airless (`atmosphere: null`), dead (`rawTidal ~0`), and cold (`T_eq 150 < 450`), i.e. dead-lid icy despun, condition-scalar-**indistinguishable from Frozen**. Battering Crystal is defensible (same physics as Frozen), but Crystal is a deliberately *pristine faceted* world and is NOT in the contract's named set — so this is a scope question for Max, NOT a silent plan choice. **It cannot be tightened away without reintroducing a label/archetype read** (there is no condition scalar separating pristine-Crystal from Frozen), which LANDMINE #4 forbids. Recommendation: accept Crystal as an intended dead-lid-icy target (the principled data-gate can't exclude it cleanly); surface at UAT so Max rules. **Byte-inert either way** (Crystal's `craterField` is unhashed; the 75-golden holds — BS-m3 below), so this is a UAT/scope call, never a hard stop.

**Gate correctness is a UAT/behavioral risk, NOT a byte-safety risk (byte-safety lens BS-m3 — acknowledged, plan already correct).** If `isImpactSurface` ever mis-fired on an unintended golden preset, `craterField` is STILL unhashed ⇒ the 75-golden holds. So gate accuracy is validated by `crater-gate.mjs` (behavioral) and does not endanger byte-identity — the build agent should not over-index on the gate for AC-ZERO-CLOBBER.

**Seam call (inside `writeBodyRelief`, the V2-4 §0 IIFE post-dispatch block, alongside `writeProvince`):**
```
writeAccommodation(carrier);                                   // V2-4
initSedimentHost(carrier);                                     // V2-4
if (relief.plateDiag) writePassiveMargins(carrier, relief.plateDiag, bodyDrivers, { macroSeed });  // V2-4
writeProvince(carrier, { seed: macroSeed });                   // V2-4
writeBombardment(carrier, cond, { macroSeed });                // V2-5 — UNIVERSAL; self-gates on cond scalars
relief.figure = deriveFigureDescriptor(cond);                  // V2-4
```
Order-independent w.r.t. the other post-writes (reads `cond` + finished `carrier.verts`/`adj`, writes only `craterField`). Byte-inert (new unhashed channel + new alea stream). On the 15 goldens: fires only on Frozen + Crystal (populated `craterField`, byte-safe); zero on the other 13.

---

## §4 — RENDER COMPOSITE (route(), displacement at sample time)

**Composite seam — extend the EXISTING overlay composite (`compositeMargins`) in `route()`, do NOT add a second gradient recompute.** Today `route()` does:
```
const composited   = compositeMargins(carrier);                     // height + shelfDepth, or null if all-zero
const marginHeight = composited || carrier.height;
const marginGrad   = composited ? computeAdjGradient(carrier, composited) : reliefGrad;
```
**Change:** `compositeMargins(carrier)` sums **both** overlay channels — `out[i] = height[i] + shelfDepth[i] + craterField[i]` — and its "any nonzero?" early-out tests `shelfDepth[i] !== 0 || craterField[i] !== 0`. **Null-tolerant read (byte-safety lens BS-m2 — FOLDED):** bind `const cf = carrier.craterField;` once and read `(cf ? cf[i] : 0)` (mirroring the existing `const sd = carrier.shelfDepth; if (!sd) return null;` first-guard at compositeMargins:203-204). Both `makeSphereField` and `makeSubstrate` allocate `craterField` (§1), so it is present today — but the null-tolerant read avoids a latent `TypeError` if any future carrier reaches `route()` without the field, and lets the early-out short-circuit when only `shelfDepth` is populated. This keeps the `marginHeight`/`marginGrad` variable names (so the SPLIT-TRAP guard greps in `relief-router-repoint.test.js` + `relief-height-cube.test.js`, which assert the single shared DATA source is named `marginHeight`, stay green — verified those tests grep `marginHeight`, not `compositeMargins`). The composited surface then feeds **both** consumers unchanged: the router re-point (`height = marginHeight; grad = marginGrad`) and `bakeHeightCube({ height: marginHeight, grad: marginGrad })`. **Recomputing `marginGrad` from the composited surface is what makes craters reshade** (feeding composited height with a stale pre-crater gradient would displace-without-reshading — the V2-4 A-M1 lesson). `carrier.height` is NEVER mutated; the goldens bypass `route()`. On non-target worlds `craterField` is all-zero → `compositeMargins` returns null (unless margins fire) → byte-identical render (AC-LAB c precedent). *Adjudicable detail: if renaming the helper reads cleaner, rename `compositeMargins`→`compositeReliefOverlays` and update its two call sites + the SPLIT-TRAP greps in the same commit — flagged, not silent.*

**Ejecta-as-albedo (per the rubric "direct displacement (craters) + ejecta as albedo").** The displacement channel carries bowl + rim + a **low ejecta apron** (§2a `craterProfile`). The ejecta apron reads as **brightness via the EXISTING shading** of the composited normals (`computeAdjGradient` on `marginHeight` → the height cube's GBA → `perturbAnalytic` bends the normal → rims/ejecta catch light = brighter halos) — **no new albedo attribute, so the atmo-shared planet vertex/fragment shader is untouched** (atmo fence held; the V2-4 R-atmo-collision discipline). A dedicated ejecta-albedo attribute is a **documented deferral** (recorded in BOMBARDMENT-MAP §7, analogous to the province V2-9 palette deferral) — it would add an attribute to the atmo-shared geometry, out of fence this increment.

**RESOLUTION CHECK (the V2-4 shelf lesson — craters MUST be node-resolvable, put numbers in the plan).** V2-4's shelf/break/slope were **sub-node** (`meanEdgeAngle ≈ 2.5° @ N8000`, `≈ 1.0° @ N≈40k` lab mesh) and rendered as a smooth apron. For craters to read AS craters:
- Lab render mesh N ≈ **40 000** ⇒ `meanEdgeAngle ≈ sqrt(4π/N) ≈ 0.0177 rad ≈ 1.0°`.
- **Node-resolvability requires a crater span ≥ ~3 nodes** (bowl + rim need ≥3 samples to not smooth out). So the size band is anchored in **geodesic radians** (resolution-independent, the passiveMargins trick), pinned by `crater-scale.mjs`:
  - `D_MAX_RAD ≈ 0.50 rad ≈ 28°` (giant basins) → **~28 nodes across** — clearly resolvable; these few large basins **carry the read at judging distance**.
  - `D_MIN_RAD ≈ 0.05 rad ≈ 2.9°` (~3 nodes) — the small end sits near the node floor and blurs into a **peppered texture** (the correct Moon/Mercury look: a few dominant basins over a battered small-crater texture).
- **The V2-5 pass-the-shelf-lesson guarantee:** the power-law's *large* end is many-node (28×), so the increment does NOT repeat V2-4's "everything sub-node → smooth gradient" failure. `crater-scale.mjs` prints the node-span of each size bin at the lab N and asserts `D_MAX_RAD/meanEdgeAngle ≥ 10`.
- **Depth/rim scale** (all vertical amplitudes in **normalized-height units**, pinned by `crater-scale.mjs` against the despun height amplitude, the `MARGIN_LIFT_N = 0.1127` precedent — see §2a `A(D)`): `CRATER_DEPTH_N` is the normalized-height depth constant (the fresh-simple-crater `d/D ≈ 0.2` informs the *initial guess* but the pinned value is a normalized-height amplitude, calibrated so `A(D_MAX) ≥ MIN_BASIN_DEPTH_N` — M-m3 legibility floor, NOT a bare `fraction × radians`); `D_REF_RAD` + `DEPTH_POW` set the size→amplitude curve; `RIM_HEIGHT_FRAC ≈ 0.04`, `EJECTA_FRAC ≈ 0.015` are fractions **of `A(D)`**; `RIM_W ≈ 0.1`, `RIM_FRAC ≈ 1.0`, `FLOOR_FRAC ≈ 0.5` are dimensionless profile-shape (horizontal) constants.

---

## §5 — NEW PRESET (`Moon/Mercury (impact-airless)`)

**Exact `DRIVER_PRESETS` entry** (added to `driver-presets.js`, placed after `Mars (arid rocky)` — the other unmapped dead rocky body; **NOT added to `PRESET_ARCHETYPE`**):
```
'Moon/Mercury (impact-airless)': {
  radiusEarth: 0.38, massEarth: 0.04, eccentricity: 0.05,
  starMassEarth: 332946, orbitRadiusEarth: 117275,        // Frozen/Crystal's cold-far orbit ⇒ rawTidalIoRatio ~0 (guaranteed dead)
  composition: { ironFraction: 0.4, density: 4.5, volatileFraction: 0.02 },  // density 4.5 ⇒ unambiguously rocky; vf 0.02 ⇒ bone-dry airless
  age: 4.5, T_eq: 235,                                     // T235 < COLD_DEAD_T(250) with L-margin (below); airless dead
  tidalState: { locked: false },                          // UNLOCKED — else dispatch (3b) routes eyeball-despun, not dead-lid
  atmosphere: null, habitability: 0,
  surfaceHistory: { erosion: 0.05, bombardmentIntensity: 0.9, resurfacingRate: 0.05 },  // battered old surface (legacy-knob consistency; the writer reads condition.age, not these)
},
```
Also: add `'Moon/Mercury (impact-airless)'` to the lab's `NAMED_BODY` Set (`planet-lod-lab.html`) so `drawPresetRadius` returns the canonical `0.38` (the Mars precedent — no seeded radius draw ⇒ deterministic `surfaceGravity`). `NAMED_BODY` is a lab-local Set, off the drift-guard fixture.

**HAND-VERIFICATION that `computeE1` + the dispatch route it dead-lid rocky** (constants from `e1Regime.js`; arithmetic shown):
- `g = massEarth/radiusEarth² = 0.04/0.38² = 0.277 g`; `mass = g·d² = 0.277·0.1444 = 0.040`.
- `compositionClass`: atmosphere null (not gas); `carbonToOxygen` undefined (not carbon); `smoothstep(2.5,3.9,4.5)=1 > 0.5` ⇒ **`rocky`**.
- `lidStrength` (T=235,V=0.02,ρ=4.5,g=0.277,age=4.5): `coldness=1−smoothstep(200,320,235)=0.794`; `z=clamp01(0.15+0.55·0.794+0.25·0.45)=0.6995`; `anneal=smoothstep(300,750,235)=0`; `dryness=1−smoothstep(0.05,0.20,0.02)=1`; `muProxy=clamp01(0.55·1)=0.55`; `gMod=clamp(0.90,1.12,(4.5·0.277/4.95)^0.15)=clamp(…,0.813)=0.90`; **`L = clamp01(0.82·(0.55·0.6995 + 0.75·0.55)·0.90) = 0.588`**.
- `convectiveVigor`: `radiogenic=1−0.45=0.55`; `vigor=0.55·(0.5·0.040 + 0.5·0.38³)=0.0261`; **`Φ = sqrt(0.0261)+10·0 = 0.161`**.
- `rawTidalIoRatio ≈ 0` (orbit 117275) ⇒ `m_hp = 0 − 0.45 = −0.45`.
- **`computeE1` rocky branch:** `m_hp>0`? no. `inSeededBand`? mass 0.040 ∉ [0.6,1.6] ⇒ no. `L≥L_STRONG(0.63) && rawTidal<0.15`? **L=0.588 < 0.63 ⇒ no** (margin 0.042). `T<250 && Φ<0.4 && rawTidal<0.15`? **235<250 ✓, 0.161<0.4 ✓, 0<0.15 ✓ ⇒ `geodynamicRegime = 'dead-lid'`.**
- **`writeBodyRelief` dispatch (rocky):** (3a) `m_hp>0`? no. (3b) `locked`? false ⇒ no. (3c) `isUnbrokenLidPath(e1)`? `rocky` yes, but `heatPipe = m_hp>0` = false, `hotSurfaceStagnant = geodynamicRegime==='stagnant' && L≥0.63` = false (regime is 'dead-lid') ⇒ **false**. (3d) `inSeededBand`? no. (3e) `geodynamicRegime==='mobile'`? no. **(3f) `return despun()`.** ✓✓✓
- **Margins to the nearest wrong branch (AT THE NATIVE POINT `g=0.277, age=4.5`):** L_STRONG 0.042; COLD_DEAD_T 15 K; COLD_DEAD_PHI 0.24 — robust on all three. **This derivation pins the STATIC preset's routing only.** `lidStrength` reads `condition.surfaceGravity` (↑ via `gMod`) and `condition.age` (↑ via `z`'s `aN` term), so once the lab plumbs the gravity/age sliders into those scalars (§6c), sweeping them UP pushes `L` past `L_STRONG = 0.63` and the rocky branch flips dead-lid→stagnant (e1Regime rule at `L >= L_STRONG`, checked BEFORE the cold-dead-lid branch) → the base writer becomes stagnant-lid, NOT despun. That is **expected E1 physics over the sweep, adjudicable — NOT a §9 hard stop** (the hard stop is the STATIC preset mis-routing at its native point). See §6c for the bounded-demo window and §9 for the reworded trigger.

**Lab list placement:** the preset slots into the lab dropdown right after `Mars (arid rocky)` (the impact-airless dead-rocky neighbor), keeping the list logically sorted (living → hot → icy → **dead-rocky cluster** → giants → exotics). **Explicitly NOT golden** (absent from `PRESET_ARCHETYPE`; the 75-golden loop never sees it — LANDMINE #2).

---

## §6 — LAB-UI INTEGRATION

Per the LAB-UI REQUIREMENT (Max's standing directive: the lab stays updated + logically sorted so he UATs without hand-holding). Enumerated edits, all `planet-lod-lab.html` ground-owned + `planet-feature-associations.js`:

**(a) DEFAULT_DRESSING — boots judgment-ready, cratered at judging distance.** Add to `DEFAULT_DRESSING` (`planet-feature-associations.js`):
```
'Moon/Mercury (impact-airless)': [],   // airless: the writer carrier (bombardment overprint) IS the look
```
Empty like the other airless entries (`Frozen`/`Europa`/`Lava`) — the crater writer carrier is the world; no legacy dressing stacked. "Judgment-ready cratered at judging distance" comes from the writer firing on this preset (§3) + the carrier being routed as the relief source (reliefBakeStrength > 0, the lab default), NOT from a dressing list.

**(b) `✦ current` summary line — WITHOUT a new FEATURES entry (drift-guard-safe).** The `we-summary` block (`refreshWorldEngineSummary()`) builds `currentBits` from `carrierOn` + `FEATURES[k].provenance === 'writer'`. Adding a `FEATURES` entry would require a bound `*Enabled` panel key (the drift guard asserts `panelEnableKeys.has(FEATURES[k].enableKey)` for every entry) — which **violates** LANDMINE #6 ("no `*Enabled` key"). So, following the V2-4 province precedent (represent writer output without a taxonomy entry), inject the crater-writer bit **directly in `refreshWorldEngineSummary()`**:
```
const carrier = riverOverlay.reliefCarrier;   // read-only handle already exposed (V2-4)
const cratered = carrier?.craterField && carrier.craterField.some(v => v !== 0);
if (cratered) currentBits.push('craters: writer overprint');
```
This renders a `✦ current: … · craters: writer overprint` line on the target presets (blue `we-current`), reads the LIVE carrier field (label-free), adds NO `FEATURES` entry, NO `*Enabled` key, NO archetype membership ⇒ `planet-archetypes.test.js` stays green. **Legacy F2/F3 `craters`/`ejecta` keep their placeholder classification** (no `provenance` field) and continue to show amber `▢ placeholder` when hand-toggled — untouched (LANDMINE #5).

**(c) Driver sliders — reuse gravity, ADD age (both as driver overrides, NO `*Enabled` key).**
- **Gravity — reuse the EXISTING `driverOv.gravity` slider** (`fBodyDrivers.add(driverOv, 'gravity', 0.1, 3.0, 0.01)`), BUT it currently patches only the FLAT `massGravity` key, NOT `condition.surfaceGravity` (the writer's read). One-line plumbing in `buildBodyDrivers`, mirroring the existing `tsurf` overlay:
  ```
  if (useOv('gravity')) _cond.surfaceGravity = driverOv.gravity;   // NEW — flow the gravity slider into condition.surfaceGravity (D14) the bombardment writer reads
  ```
- **Age — ADD a new `driverOv.age` slider** (there is NO age slider today: "age descoped Inc.2"). It is a **driver-override value slider, NOT a `*Enabled` key** — explicitly permitted by LANDMINE #6 and required by AC-LAB ("the gravity/age driver sliders move the population live"):
  - `driverOv.age = 4.5` initial (added to the `driverOv` object).
  - `resetDriverOverrides`: seed `driverOv.age = fp.age ?? 4.5;` (mirrors `driverOv.tsurf = fp.T_eq ?? 288`).
  - `buildBodyDrivers`: `if (useOv('age')) _cond.age = driverOv.age;` (nested — byte-safe; a FLAT `age` would re-drive magmaThermal, R1).
  - GUI: `fBodyDrivers.add(driverOv, 'age', 0.1, 10, 0.1).name('age (Gyr)').listen().onChange(() => _onDriverDrag('age'))` — the same `_onDriverDrag` A/B-touch idiom as `gravity`/`volatiles`.

- **⚠ THE PLUMBING COUPLES THE SLIDERS TO THE E1 ROUTE, FOR EVERY PRESET (mechanism lens M-MF2 — FOLDED).** `condition.surfaceGravity` and `condition.age` are EXACTLY the scalars `computeE1`→`lidStrength` reads for routing. So these two overrides are NOT crater-only — they change the derived dispatch for whatever preset is selected:
  1. **On Moon/Mercury:** sweeping gravity or age UP pushes `L` past `L_STRONG = 0.63`; the base terrain flips **despun → stagnant-lid** (Venus-like ridged terrain) above the crossover, while craters keep stamping (`isImpactSurface` is gravity/age-INDEPENDENT) — so above the crossover the render is craters-on-stagnant-lid, not craters-on-despun. This is real physics (old/dense/high-g dry rocky → strong lid), NOT a bug.
  2. **On OTHER presets (semantics change to an EXISTING control):** today the gravity slider patches only flat `massGravity` (which `computeE1` does NOT read), so dragging it never reroutes. After this plumbing, dragging gravity/age can reroute in-band Rocky/Ocean and others too. **This is a scope expansion of the shared gravity slider — SURFACE to Max** (§9 adjudicable): accept it as the correct long-term behavior (drivers should drive the route), or Moon/Mercury-scope the plumbing if Max wants other presets' slider behavior unchanged.
- **BOUND THE AC-LAB / AC-UAT DEMONSTRATED SWEEP to the dead-lid window** so Max sees the intended craters-on-despun read throughout: gravity `≈ [0.1, 0.85]`, age `≈ [1, 8.5]` (the empirically-observed dead-lid band at the native other-scalars; `crater-drivers.mjs` prints the exact `L`-crossover per axis). Note the crossover in the AC-LAB evidence so Max is not surprised if he pushes a slider past it. The MULTIPLY count/size response is fully demonstrable within this window.
- **Byte-safety of the buildBodyDrivers edits:** the golden harness (`v2-0-carrier-golden.mjs`) builds its bundle WITHOUT the lab's `buildBodyDrivers`; these overrides fire only when a slider is dragged in `override` mode ⇒ the golden path and every un-dragged preset are untouched. No `*Enabled` key added ⇒ `panelEnableKeys` set unchanged ⇒ `planet-archetypes.test.js` green. (The route-coupling above is a LIVE-lab behavioral change only; it never reaches the headless golden path.)

---

## §7 — SLICE DECOMPOSITION (calibration → data → render/preset → lab-UI)

**Calibration FIRST (pure `node`, committed under `docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/`, the V2-5s `*.mjs` precedent; run + output committed BEFORE the writer is finalized):**
1. `crater-scale.mjs` — prints `meanEdgeAngle` at the lab render N + the node-span of each size bin; pins the horizontal size band `D_MIN_RAD`/`D_MAX_RAD` (asserts `D_MAX_RAD/meanEdgeAngle ≥ 10`) + the **normalized-height amplitude** constants `CRATER_DEPTH_N`/`D_REF_RAD`/`DEPTH_POW` (with the `A(D_MAX) ≥ MIN_BASIN_DEPTH_N` legibility floor, M-m3) against the despun height amplitude, + the dimensionless profile-shape constants `RIM_HEIGHT_FRAC`/`EJECTA_FRAC`/`RIM_W`/`RIM_FRAC`/`FLOOR_FRAC`.
2. `crater-powerlaw.mjs` — draws populations across seeds, fits the log-log SFD, pins `B_SFD` + confirms the uniform-null rejection; pins `N_CRATERS_REF`.
3. `crater-drivers.mjs` — sweeps gravity + age at fixed seed, prints count/size response, pins `G_REF`/`AGE_REF`/`K_AGE`/`K_GD`/`K_GS` (the MULTIPLY exponents + neutral references). **Also prints the `L`-crossover per axis** (the gravity/age at which the base route flips dead-lid→stagnant, §6c) so the AC-LAB demo window is grounded in the observed number, not a guess. **Legibility check (mechanism lens M-m4 — FOLDED):** prints `craterField` min / max / variance at the sweep EXTREMES (the low-g / high-age corner stamps thousands of overlapping craters; the unbounded `+=` superposition can over-deepen/churn — monotone-but-illegible would pass AC-MULTIPLY while failing AC-UAT). Confirms the field stays legible (bounded, readable range) at both corners, not just monotone.
4. `crater-gate.mjs` — prints `isImpactSurface` for all 18 presets; pins `CRATER_ATMO_MAX`/`CRATER_TIDAL_MAX`/`CRATER_T_MAX` (confirms exactly the four targets fire).

**SLICE 1 — channel + writer (data ACs, all headless).**
- Files: `sphereField.js` + `substrate.js` (allocate `craterField`); NEW `bombardment.js`; `planet-lod-rivers.js` (the ONE universal seam call). Calibration constants baked in.
- Tests (`tests/worldengine-v2-5-bombardment.test.js`): **AC-CHANNEL** (present on both carriers + distinct identity + `height` byte-identical vs goldens **at the golden N=700 carrier**; non-triviality — variance>0, both signs — asserted **at ≈40k AND/OR via a direct `craterProfile` unit test**, NOT at N=700 — M-MF3 split), **AC-POWERLAW** (**differential `dN/dlogD`** log-log fit, slope ∈ [−2.2,−1.8] & R²>0.95 every seed + uniform-null `dN/dlogD` slope ≥0/outside — M-MF1), **AC-MULTIPLY** (**direct-writer-metric** gravity/age sweeps on a synthetic condition, **non-strict** monotone count/size, neutral reference as normalization check — M-MF2/M-m1/M-m6), **AC-DISTINCT** (repeat-seed byte-equal + inter-seed + (g,age)-grid distinct), **AC-0 ch.1** (writer greps clean — and contains ZERO `computeE1`/`e1Regime` substrings incl. comments, BS-m1; shadow-audit auto-PASS by enumeration).
- Gate: full AC-ZERO-CLOBBER (75-golden + lid anchors + quartet + dispatch-oracle + atmo suites + `planet-archetypes` + the new suite; `git show --stat` fence). **→ COMMIT 1** `V2-5 slice-1: bombardment writer + craterField host channel (power-law, MULTIPLY, byte-inert)`.

**SLICE 2 — render composite + new preset (AC-PRESET). ⚠ THIS SLICE ADDS THE 18TH `DRIVER_PRESETS` KEY — it MUST include the two code-level guard edits below or the AC-ZERO-CLOBBER gate hits a hard RED (dispatch-oracle crashes at collection).**
- Files (source): `planet-lod-rivers.js` (extend `compositeMargins` to sum `craterField`, null-tolerant — BS-m2); `driver-presets.js` (the new preset); `planet-lod-lab.html` (`NAMED_BODY` add).
- Files (guard-test edits — REQUIRED, BS-MF1/BS-MF2, the Mars/Hot-Jupiter-join precedent, NOT a re-capture):
  - `tests/worldengine-v2-3-dispatch-oracle.test.js`: add the `ADJUDICATION` row `'Moon/Mercury (impact-airless)': { today: 'despun', derived: { path: 'despun', shellRegime: null } }` (writer-identical, like Mars); bump `NAMES17.length` assert 17→**18** (:132) and the describe/it titles' "17"; bump `equal.length` 15→**16** (:154, leave `rerouted.length` at 2); the `NAMES17 ⇄ ADJUDICATION` key-set equality (:135) and seed-invariance loop (:172) then pass with the new row present.
  - `tests/v2-0-slice-a-byte-safety.test.js`: bump `Object.keys(DRIVER_PRESETS).length` 17→**18** (:31); change the whole-object `toEqual(DP_SNAPSHOT)` (:41) to a **per-original-key** assertion (`for each of the 17 ad156cc keys: expect(DRIVER_PRESETS[key]).toEqual(DP_SNAPSHOT[key])`) — preserves the extraction-pin semantics ("the original 17 are unmutated") WITHOUT re-capturing `v2-0-driver-presets.ad156cc.json` (fixture stays git-diff-empty).
- Tests: **AC-PRESET** (headless route + the new `ADJUDICATION` row for the preset ⇒ `despun` with populated `craterField` — §5 arithmetic is the oracle; **Frozen 5/5 golden `height` rows byte-identical at N=700 AND `craterField` populated** — the cratered *non-triviality* is the ≈40k assertion from SLICE 1, NOT asserted on the N=700 golden rows, M-MF3); composite byte-safety (non-target worlds render value-identical; SPLIT-TRAP greps green).
- Gate: full AC-ZERO-CLOBBER — the BYTE-UNCHANGED guards (quartet + `planet-archetypes` + conformance) green with no edit; the dispatch-oracle + slice-a green AFTER the enumerated row/assertion edits; ALL fixture files (`v2-0-carrier-goldens.json`, `v2-0-driver-presets.ad156cc.json`, `v2-0-preset-archetype.ad156cc.json`) **git-diff-empty**. **→ COMMIT 2** `V2-5 slice-2: route() crater composite + Moon/Mercury impact-airless preset (dead-lid, non-golden; oracle+slice-a rows join, no re-capture)`.

**SLICE 3 — lab-UI (AC-LAB working-Claude live drive).**
- Files: `planet-feature-associations.js` (DEFAULT_DRESSING); `planet-lod-lab.html` (age slider + gravity→condition plumbing + `✦ current` summary bit + dropdown placement).
- Tests: `planet-archetypes.test.js` green (no `*Enabled` key added); AC-LAB is working-Claude's fresh-context browser drive on `:5175` (preset boots cratered; gravity/age sweeps visibly move count/size; console clean; screenshots archived in `evidence/`; agent pages closed — window hygiene).
- Gate: full AC-ZERO-CLOBBER + AC-LAB evidence. **→ COMMIT 3** `V2-5 slice-3: lab-UI (Moon/Mercury dressing + age slider + gravity-plumb + ✦ crater summary)`.

**Docs (folded into the commits):** `BOMBARDMENT-MAP.md` — for `craterField`: function (plain language), pipeline position (written post-dispatch in `writeBodyRelief`, composited by `route()`, EDITED by the #6 epoch editor), named consumers (AC-0 list), deliberate non-goals (no per-basin ID map; ejecta-albedo attribute deferred; atmospheric shielding deferred per Q5; volcano legibility routed to V2-7/V2-8 per Q4). Plus the `record-build-intent` note.

---

## §8 — AC MAP (each of the 9 contract ACs → the concrete closer)

| AC | Layer | Closed by |
|---|---|---|
| **AC-0** | unit | dispatch-oracle label-free grep leg (unchanged) + shadow-audit auto-PASS for `bombardment.js` (zero `computeE1`/`e1Regime` substrings incl. comments — BS-m1) + router-audit + `planet-archetypes` drift; grep of the writer's reads (condition scalars only); `route()` documented as the `craterField` consumer + #6 host in BOMBARDMENT-MAP. |
| **AC-CHANNEL** | unit | 75-golden byte-identity (+8 anchors) = 83/83 with git-diff-empty fixtures; `craterField` present/distinct on both carriers + `height` bytes identical **at the golden N=700**; non-triviality (variance>0, both signs) asserted at **≈40k and/or via direct `craterProfile` unit test** (M-MF3 split — NOT at N=700). |
| **AC-POWERLAW** | unit | `crater-powerlaw.mjs` (pins band; prints uniform-slope margin every seed) + `tests/worldengine-v2-5-bombardment.test.js` **differential `dN/dlogD`** log-log fit: slope ∈ [−2.2,−1.8], R²>0.95 every seed; uniform-null `dN/dlogD` slope ≥0/outside the band (M-MF1). |
| **AC-MULTIPLY** | unit | `crater-drivers.mjs` (pins exponents/refs; prints L-crossover + legibility) + **direct-writer** gravity/age sweeps on a synthetic condition (route-independent — M-MF2): **non-strict** monotone count/size in the §2c direction table (M-m1); `(G_REF, AGE_REF)` ≈ neutral (normalization check — M-m6). |
| **AC-DISTINCT** | unit | repeat-seed byte-equal; inter-seed L2 large; (g,age)-grid distinct populations. |
| **AC-PRESET** | integration | headless route + the SLICE-2 `ADJUDICATION` row for the new preset ⇒ `despun` + populated `craterField` (§5 arithmetic is the oracle); Frozen 5/5 golden `height` rows byte-identical at N=700 with `craterField` populated (non-triviality is the ≈40k assertion — M-MF3). |
| **AC-LAB** | integration (live) | working-Claude fresh-context drive on `:5175`: preset renders cratered at judging distance; gravity + age slider sweeps visibly change count/size **within the bounded dead-lid window** (§6c; crossover noted in evidence); console clean; screenshots archived. |
| **AC-ZERO-CLOBBER** | unit | full suite at baseline signature from the repo dir at each commit; BYTE-UNCHANGED guards (quartet + `planet-archetypes` + conformance) + atmo suites unchanged; **dispatch-oracle + slice-a get code-level row/assertion edits at SLICE 2** (Mars/Hot-Jupiter-join precedent, BS-MF1/MF2 — NOT re-capture); ALL fixtures git-diff-empty. |
| **AC-UAT** | uat | Max drives the lab solo on Moon/Mercury + Frozen, re-rolling seeds + sweeping gravity/age — `deferred-to-max`; the verify workflow never PASSes it. |

---

## §9 — DEVIATION TRIGGERS (hard stops vs adjudicable)

**HARD STOPS (the plan is wrong — STOP, do not proceed):**
- Any byte diff in `tests/fixtures/v2-0-carrier-goldens.json` or any `HASHED_FIELDS` change on any golden preset (LANDMINE #1). Fixtures are NEVER re-captured.
- Any new `*Enabled` key, or any new `FEATURES` entry that binds one (LANDMINE #6 / drift guard).
- Any `.label` / archetype-string / `e1.geodynamicRegime` read in the writer OR in the dispatch block (shadow-audit / dispatch-oracle).
- Any edit to `climate-e5.js` / `emission-e.js` / storm-band sections / the atmo-shared planet shader (atmo fence), or to legacy `craterCombiner`/`ejectaCombiner`/`uCrater*`/`uEjecta*` (LANDMINE #5).
- Any `carrier.height` mutation for the crater layer (LANDMINE #1 — the whole own-channel discipline).
- The new preset routing to anything but `despun()` **AT ITS NATIVE POINT (`g=0.277, age=4.5`)** — re-verify the §5 arithmetic against live `e1Regime.js` constants before proceeding (if the atmo merge or any edit moved a threshold, re-derive; do NOT add a dispatch rule to force it). **(Reworded — mechanism lens M-MF2.)** A *slider-swept* reroute to stagnant-lid at high gravity/age is EXPECTED E1 physics (`L` crosses `L_STRONG`, §5/§6c), NOT this hard stop — it is adjudicable (below).

**ADJUDICABLE (record in §10, surface to Max if it touches an AC mechanism):**
- Calibration moving a constant (`B_SFD` band, `D_*_RAD`, `N_CRATERS_REF`, `CRATER_DEPTH_N`/`D_REF_RAD`/`DEPTH_POW`/`MIN_BASIN_DEPTH_N`, the MULTIPLY exponents/refs, the gate thresholds) — the calibration output IS the source of truth; record the observed number.
- Renaming `compositeMargins`→`compositeReliefOverlays` (with the SPLIT-TRAP greps updated in the same commit).
- The ejecta-as-albedo mechanism (displacement-shaded halos this increment; a dedicated albedo attribute is a deferred seam) — if Max wants albedo ejecta now, it re-opens the atmo-shader fence (surface, don't absorb).
- The `age` slider's range/step, or whether age also mildly scales individual size (default: age→count only) — a taste detail for AC-LAB.
- **(M-MF2) The gravity/age slider plumbing changes the derived route for EVERY preset** (dragging gravity/age can now reroute in-band Rocky/Ocean etc., where today the gravity slider only touches flat `massGravity`). Surface to Max: accept as correct long-term behavior, or Moon/Mercury-scope the plumbing. The bounded AC-LAB demo window (gravity ≲0.85, age ≲8.5) keeps Moon/Mercury on despun for the demonstrated sweep.
- **(M-m5) The gate fires on Crystal (faceted)** — airless-dead-cold, condition-scalar-indistinguishable from Frozen — extending the overprint beyond the contract's named "Frozen + Mars-class" set. Byte-inert; cannot be excluded without a forbidden label read. Surface at UAT for Max to confirm (recommend: accept as an intended dead-lid-icy target).
- **(M-m2) Boosting `K_GS` above the physical 0.17** for individual-size slider legibility (size response is otherwise a weak ~1.3× over a normal drag) — a Max taste call; default keeps the physical exponent, count carries the AC-LAB read.
- If an **unexpected** golden preset — one NOT in the §3 target set (i.e. anything other than the intended Frozen + Crystal, which fire by design and are byte-safe on their unhashed `craterField`) — trips `isImpactSurface` after a merge, STOP and re-derive the gate; do not weaken the predicate silently.

---

## §10 — Build deviations

*(Empty at plan time. Working-Claude / build agents append `{slice, planned, actual, reason, AC-impact}` rows as they occur — nothing silent.)*

| Slice | Planned | Actual | Reason | AC-impact |
|---|---|---|---|---|

---

## §11 — Lens log (adversarial review fold, 2026-07-17)

Two adversarial lenses reviewed this plan. Every finding below is resolved. Anchors were re-verified against live source at HEAD `acc4227` (the atmo→L1 merge has landed; all cited symbols intact).

### Byte-safety lens

- **BS-MF1 — Adding the 18th preset crashes `worldengine-v2-3-dispatch-oracle.test.js`, which the plan claimed "stays green unchanged." → [FOLDED].** Verified: `NAMES17 = Object.keys(DRIVER_PRESETS)` (oracle:50); the module-level `const rows = NAMES17.map(name => ADJUDICATION[name].today)` (:123) throws `TypeError` on a missing key **at collection**, crashing the whole file; plus `:132/:135/:154/:172`. The plan's "Mars/Hot-Jupiter precedent" was self-refuting — those two ARE in this 17-row oracle. **Changed:** §0 LANDMINE #2 CORRECTION block + §0 guardrail split (BYTE-UNCHANGED vs code-level-edited); §7 SLICE 2 enumerates the `ADJUDICATION` row add + `:132`→18 + `:154`→16; §8 AC-0/AC-ZERO-CLOBBER; §9 framing. Adjudicated as a code-level table edit (the V2-3 Mars/HJ-join precedent), NOT a golden re-capture.
- **BS-MF2 — Adding the 18th preset breaks `v2-0-slice-a-byte-safety.test.js` (`:31` count, `:41` deep-equal); plan silent. → [FOLDED].** Verified `:31`/`:41` against source; `:38` stays green because `PRESET_NAMES = Object.keys(DRIVER_PRESETS)` (driver-presets.js:171); confirmed `v2-0-driver-presets.ad156cc.json` is a SEPARATE file from the carrier golden. **Changed:** §7 SLICE 2 bumps `:31`→18 and converts `:41` to a per-original-key subset assertion — preserving the "original 17 unmutated" pin WITHOUT re-capturing the fixture (git-diff-empty). Distinguished from the immutable carrier golden in §0/§8/§9.
- **BS-m1 — shadow-audit `src.includes('computeE1')` (:49) has no comment stripping; a header comment naming `computeE1` would fail. → [FOLDED].** Verified `:49` raw substring + `:50` import-form regex. **Changed:** §2 explicit build note — `bombardment.js` must contain ZERO `computeE1`/`e1Regime` substrings incl. comments; §7 SLICE 1 + §8 AC-0 echo it.
- **BS-m2 — `compositeMargins` reads `carrier.craterField[i]` unconditionally; latent `TypeError` if a future carrier lacks it. → [FOLDED].** **Changed:** §4 — null-tolerant `const cf = carrier.craterField; (cf ? cf[i] : 0)`, mirroring the existing `shelfDepth` first-guard. Robustness only (both allocators populate it today).
- **BS-m3 — gate mis-selection is byte-inert, not byte-safe-critical (plan is correct). → [ACKNOWLEDGED, no substantive change].** The lens explicitly confirmed the plan right; added a one-line §3 clarification so the build agent treats gate accuracy as a `crater-gate.mjs` behavioral check, not an AC-ZERO-CLOBBER risk.

### Mechanism / statistics lens

- **M-MF1 — the power-law uniform-null rejection is mis-derived; a bounded-uniform diameter population gives a NEGATIVE cumulative log-log slope (magnitude ~0.5–2), NOT ≈0, so the null is not decisively rejected; R² on a cumulative is a weak discriminator. → [FOLDED, with a numeric correction to the lens].** The finding is correct (uniform cumulative `N(>D)` is linear → log-log slope runs −0.1…−∞). **Changed:** §2b now fits the DIFFERENTIAL `dN/dlogD` (counts per log-spaced bin): power-law slope `−B ≈ −2.0` (band `[−2.2,−1.8]` preserved), uniform null `∝ D^(+1)` → slope `≈ +1`, robustly outside. `crater-powerlaw.mjs` prints the fitted uniform slope + margin + R² on all 5 seeds before pinning. **Correction to the lens:** its parenthetical "[−3.2,−2.8]" is the `dN/dD` convention and contradicts its own "slope −B ≈ −2"; I used `dN/dlogD`, which keeps the pinned `[−2.2,−1.8]` band — so the band numerics are unchanged, only the fit basis (cumulative→differential-per-log-bin) moves.
- **M-MF2 — plumbing the gravity/age sliders into `condition.{surfaceGravity,age}` makes `computeE1`'s route driver-sensitive; sweeping up crosses `L_STRONG` and reroutes the preset OFF dead-lid to stagnant-lid, tripping the plan's own §9 hard-stop. → [FOLDED].** Verified against live `e1Regime.js`: `lidStrength` reads `cv.surfaceGravity` (↑`gMod`) and `cv.age` (↑`z`), and the rocky branch checks `L>=L_STRONG(0.63)`→stagnant (:209) BEFORE the cold-dead-lid branch (:212). (Did not reproduce the lens's exact crossover values g≈0.86/age≈8.6 — those are calibration observations; the mechanism/direction is confirmed.) **Changed:** (a) §2c/§7/§8 scope AC-MULTIPLY as a **direct-writer-metric** test on a synthetic condition (route-independent); (b) §5/§6c document the crossover as expected E1 physics + note the plumbing changes the route for ALL presets (surfaced to Max, §9); (c) §6c bounds the AC-LAB/UAT demo sweep to the dead-lid window (g≲0.85, age≲8.5); (d) §9 rewords the "not despun" hard-stop to apply at the STATIC native point only.
- **M-MF3 — AC-CHANNEL's "non-trivial / both signs" must run at the golden `TARGET_N=700`, where D_MAX≈3.7 nodes and craters barely resolve → flaky. → [FOLDED].** Verified `TARGET_N = 700` (v2-0-carrier-golden.mjs:41). **Changed:** §1/§7/§8 split AC-CHANNEL — byte-identity + presence at N=700; non-triviality (variance>0, both signs) at ≈40k AND/OR a direct `craterProfile` unit test. §7 SLICE 2 + §8 AC-PRESET reworded: Frozen golden rows are byte-identical + `craterField` populated at N=700, non-triviality is the ≈40k assertion.
- **M-m1 — `nCraters=round(...)` is a staircase → count is non-strictly monotone. → [FOLDED].** §2c/§8 AC-MULTIPLY assert `≤`/`≥` (non-strict) with coarse sampling.
- **M-m2 — `sizeMul=(G_REF/g)^0.17` spans only ~1.77× full / ~1.3× per drag → weak size read. → [FOLDED].** §2c/§4 note the weakness (AC-LAB legibility rides on count); §9 lists a `K_GS`-boost taste call.
- **M-m3 — floor depth `CRATER_DEPTH_FRAC·D` conflates radians with normalized-height. → [FOLDED].** §2a recast: vertical amplitude `A(D) = CRATER_DEPTH_N·(D/D_REF_RAD)^DEPTH_POW` in normalized-height units, pinned by `crater-scale.mjs` against the despun amplitude, with an asserted `MIN_BASIN_DEPTH_N` legibility floor; §4 constants list reconciled.
- **M-m4 — unbounded `+=` superposition can over-deepen/churn at the low-g/high-age corner (monotone but illegible → AC-MULTIPLY passes while AC-UAT fails). → [FOLDED].** §7 `crater-drivers.mjs` prints `craterField` min/max/variance at the sweep extremes and checks legibility, not just monotonicity.
- **M-m5 — the gate fires on Crystal, beyond the contract's named "Frozen + Mars-class" set. → [FOLDED as surfaced adjudicable].** The plan already targets Crystal (§3 table), but the contract-vs-plan gap was unstated; Crystal is condition-scalar-indistinguishable from Frozen so it cannot be excluded without a forbidden label read. §3/§9 surface it to Max at UAT (recommend accept); byte-inert, never a hard stop.
- **M-m6 — the neutrality assertion is near-tautological (confirms the formula's own normalization). → [FOLDED as wording].** §2c/§8 relabel it a normalization sanity check, not independent physical validation.

**No findings rejected.** Both lenses' verified-sound sets (own unhashed channel, post-dispatch seam, independent `alea` stream, `route()`-only composite, label-free gate, atmo/legacy fences, §5 native-point arithmetic, N=40000 lab-mesh resolvability, lab-UI/drift-guard integration) are left intact and un-relitigated.
