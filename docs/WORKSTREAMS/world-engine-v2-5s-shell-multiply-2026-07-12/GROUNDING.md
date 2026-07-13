# V2-5s (shell-MULTIPLY) — Grounding Brief
2026-07-12 · repo `~/projects/well-dipper` @ `feature/world-engine-production-L1` (read-only; headless node/grep/vitest only)

**The increment (ROADMAP-v2-condition-first.md §3.1 :132):** "Shell-MULTIPLY (was unscheduled). Thread the D-vector into `shellRelief` so low-g vs high-g icy worlds differ within-regime (the north-star gap D2-MF5 names)." Size M, dep V2-1. §3.2 :160 pins that shell-MULTIPLY is now **explicitly scheduled** ("No MULTIPLY is silently dropped"); Reuse Ledger :187 keeps `shellRelief.js` whole as the P-LID-ICY sibling, `REGIME_WEIGHTS` = "proof-of-concept response-table *shape* only", the tidal-lineament half sibling-local, and STEP-2 as V2-7d's read-only seed.

---

## 1. shellRelief.js response surface today

Writer: `writeShellReliefSphere(carrier, drivers = {}, { macroSeed = 0, regime = 'icy-active', tune = null })` — `src/worldengine/base/shellRelief.js:165`.

- **The writer VOIDS its drivers arg** — `:166` `void drivers;` with the comment "seed-only this increment (driver-RESPONSE is the next increment, via the `tune`/drivers seam)". V2-5s is the increment that comment reserves.
- **The tune seam ALREADY EXISTS** — `:167` `const T = tune ? { ...SHELL_DEFAULTS, ...tune } : SHELL_DEFAULTS;` — byte-for-byte the sibling idiom (plates, magmatism `:88`, stagnantLid `:175`-analog). So, exactly like V2-2b-1's starting state: **no new writer machinery** — the new pieces are only (a) `shellDriversToTune` + REF constant(s), (b) dispatch threading, (c) `shellDiag.appliedTune`, (d) the lab folder/probe extension.

**Per-regime weights (`REGIME_WEIGHTS`, `:61-65`)** — selected by regime tag, NOT part of `SHELL_DEFAULTS` (i.e. NOT reachable through the tune spread):

| regime | DESPIN_W | DIURNAL_W | CHAOS_W | character |
|---|---|---|---|---|
| `icy-active` (Europa) | 0.7 | 1.0 | 1.0 | cycloids + double-ridges + masked chaos |
| `volatile-cold` (Titan) | 1.0 | 0.15 | 0.8 | despin lineaments + cantaloupe cells |
| `eyeball-despun` (Eyeball) | 1.0 | 0.0 | 0.0 | despin lineament field only; STEP-2/STEP-4 skipped |

**What each STEP derives (the render surface a tune can move):**
- STEP 0 `meanEdgeAngle` (resolution key — untouchable).
- Seeded frames: `w0`, `t_hat`, `phi0`, `detailNoise` (`alea('shell:axis|tidal|nsr|detail:'+seed)`).
- STEP 2 (only `CHAOS_W>0`): spherical-Voronoi convection partition — `cellCount = CELL_MIN + floor(rng·CELL_SPAN)` (`:194`), domain-warped centroids (`WARP_FREQ/WARP_AMP`), BFS wall-distance → `cellInteriorness` (`BELT_RADIANS`).
- STEP 1: stress tensor field — seeded amplitudes `A_despin = DESPIN_REF·(0.6+0.8·draw)` / `A_diur = DIUR_REF·(0.6+0.8·draw)` (`:233-234`), analytic normalizer `STRESS_REF = W.DESPIN_W·A_despin·(10/6) + W.DIURNAL_W·A_diur·DIUR_PEAK` (`:236`) → `stressTensile`, `thetaTraj`.
- STEP 3: steered double-ridge lineaments — gates `CREST_THRESH` (≈top-9% crack network) + `TENSILE_THRESH`; `lineamentRelief = (W.DESPIN_W+W.DIURNAL_W)·RIDGE_AMP·max(0,σ)·doubleRidge` where `doubleRidge = SHOULDER_HT·4t(1−t) − TROUGH_DEPTH·smoothstep(0.6,1,t)` (`:307-313`).
- STEP 4: chaos overlay — `CHAOS_THRESH` tension floor over `cellInteriorness`, texture `CHAOS_BASE/CHAOS_AMP/CHAOS_FREQ` (`:316-326`).
- STEP 5: assemble `SHELL_BASE + lineament + chaos + DETAIL_AMP·detail`, `RELAX_PASSES` Jacobi; **REPLACE** `carrier.height`; `grainAngle ← thetaTraj`; `faultDensity ← |stressTensile|` (`:344-367`).

**Seed-only vs regime-constant vs driver-driven today:** the axes/phases/amplitude-draws/cell placement are seed-only; every `SHELL_DEFAULTS` knob is regime-constant (same for every world in a regime); **nothing reads the D-vector**. Two Titan-regime worlds differ only by seed re-roll — exactly the D2-MF5 gap.

Diag returned (`:369-373`): `U, regime, cellId, cellCount, stressTensile, thetaTraj, lineamentNode, chaosMask, reliefStress, w0, t_hat, phi0, meanEdgeAngle, relaxPasses` — read live by `shellProbe()` (planet-lod-lab.html:6096) and by the headless structure suite (tests/worldengine-base-shell-structure.test.js).

**Dispatch call sites (both must be threaded):**
- Derived dispatch (V2-3): `planet-lod-rivers.js:490-493` — `const shell = (regime) => { const shellDiag = writeShellReliefSphere(carrier, grainDrivers, { macroSeed, regime }); … }` — reached at `:532` (`cls==='icy' && geodynamicRegime==='icy'` → `shell(e1.shellSubRegime)`) and `:543` (`locked` rocky → `shell('eyeball-despun')`).
- Migration bridge: `:569-572` `shellRegimeOf(archetype, locked)` → same call shape.
- The edit mirrors #4-M/V2-2b-1 verbatim: pass `bodyDrivers` as the drivers arg (byte-safe — the writer voids it), add `tune: shellDriversToTune(bodyDrivers, regime)`, set `shellDiag.appliedTune`.

---

## 2. THE BYTE-IDENTITY CONSTRAINT — analysis + mechanism recommendation

**The gate:** tests/v2-0-byte-identity.test.js + tests/fixtures/v2-0-carrier-golden.mjs — 15 presets × seeds [1,2,3,7,42] = 75 SHA-256 hashes over `{height, grainAngle, grainMag, regime, faultDensity}`, captured `7441c92`, **NEVER re-captured** (V2-2b-1 contract AC-ZERO-CLOBBER(a) pins that discipline). The harness builds the LIVE bundle (`buildNeutralBodyDrivers(deriveUniforms(fp), fp)` + nested `deriveConditionVector`) and runs the full `writeBodyRelief` derived dispatch.

**Which presets route shell (verified by headless run of the real dispatch, 2026-07-12):**

| preset | path | regime | live flat slots (byte-exact) | nested |
|---|---|---|---|---|
| Europa (icy moon) | shell | `icy-active` | massGravity `0.28` (=0.07/0.5²), vf `0.5`, tidalHeating `136.74504375182553` | T_eq 110, age 4.5, shellThickness 0.4, locked true |
| Titan (methane seas) | shell | `volatile-cold` | massGravity `0.15624999999999997` (=0.025/0.4²), vf `0.4`, tidalHeating `1.582697265646129e-8` | T_eq 94, age 4.5, shellThickness 0.4, locked false |
| Eyeball (locked temperate) | shell | `eyeball-despun` | massGravity `1`, vf `0.25`, tidalHeating `0.0006019832811570482` | T_eq 270, age 4.5, shellThickness 0.40498676979442294, locked true |
| Frozen (airless) | **despun** | — | (adjudicated V2-3 reroute #1 — confirmed live; carve-out in v2-0-byte-identity.test.js:69-72) | |

Key structural fact: **the three pinned shell presets occupy three DISJOINT regimes — exactly one shipped preset per regime.**

**How #2 (plates) actually handled its two presets — the precedent, analyzed:** it did **NOT** null both. `driversToTune` anchors ONLY at `D_EARTH` (plates.js:105-109 = Rocky's slots; the exact-only guard `:150-159`). I ran the live Ocean bundle through it: **non-null** — `{UPLIFT_GAIN: 1.6474595827889307, RIFT_GAIN: 0.5491531942629768, CONTINENTAL_FRACTION: 0.30000000000000004, PLATE_COUNT_MIN: 7}`. Ocean's golden row was captured (at `7441c92`, post-#2) **with that tune already baked in** — the pure, fp-stable tune function makes the hash stable across gate runs. So the plates answer to "multi-preset writer" is: *one anchored preset + the second preset pinned as-tuned at capture time*.

**That path is closed for V2-5s:** the shell rows of the 75-golden are already pinned on the **tune-less** writer output (shell() passes no tune today). Anchoring only one preset (say Europa) would make `shellDriversToTune(liveTitanBundle)` non-null → Titan's 5 golden rows move → re-capture, which the program discipline forbids ("every shipped win byte-identical until deliberately absorbed", ROADMAP :30) and which would silently re-render two AC11-UAT-passed worlds.

**Recommendation: (b) per-regime REFs** — a frozen `SHELL_REFS = { 'icy-active': <Europa's real slots>, 'volatile-cold': <Titan's>, 'eyeball-despun': <Eyeball's> }`, builder `shellDriversToTune(drivers, regime)`, each REF **ON its regime's shipped preset** (the VENUS_REF discipline — "READ-SURFACE-MATCHED, exactness is load-bearing" — not the MAGMA_REF synthetic-neutral discipline). Evidence:

1. **One preset per regime (table above)** — per-regime anchoring nulls all three exactly, and no regime contains a second shipped preset that would be forced to move. This is the property plates lacked (two presets, one response surface) and the property that makes (b) clean here.
2. **The regime tag is already in scope everywhere it's needed** — both dispatch call sites resolve it before calling the writer, and the writer itself is regime-keyed (`REGIME_WEIGHTS[regime]`). Selecting a REF by the same tag adds zero plumbing; declare the regime arg in AC-0 as dispatch-provided context (it's the same derived tuple the writer already consumes, not a label read inside the builder).
3. **(a) single-REF null-zone is incompatible with the house exact-only guard** (`===` at one point: plates.js:150-159, magmatism.js:124-127, stagnantLid.js:149-152). A monotone transfer function cannot equal its DEFAULT at three different driver values (Titan g 0.156 / Europa 0.28 / Eyeball 1.0) without being non-monotone or piecewise-flat — i.e. dead zones in exactly the response space this increment exists to open. A tolerance-band null-zone would also break AC-TUNE-RESPONSE's "measurable at small deviations" and is unprecedented in the family.
4. **Semantics match the roadmap row**: "low-g vs high-g icy worlds differ *within-regime*" — anchoring each regime at its own shipped exemplar makes the response a deviation-from-the-exemplar within that regime; *between*-regime character stays owned by `REGIME_WEIGHTS` (per Reuse Ledger :187, the weights are the response-table shape, untouched).

Guards (all V2-2b-1 mirrors): (i) null-guard FIRST — `shellDriversToTune(null|{}, r) === null` (the dispatch and the shipped shell structure tests reach `bodyDrivers === null`); (ii) exact-only identity guard per regime; (iii) unknown regime → the `icy-active` fallback, mirroring the writer's `REGIME_WEIGHTS[regime] || REGIME_WEIGHTS['icy-active']` (`:168`); (iv) **AC-TUNE-NULL's non-circular live-bundle assertion ×3** — REF slots `===` the actually-constructed live bundles for Titan/Europa/Eyeball to full float precision (this is what catches a rounded-vs-live drift before it surfaces as an unexplained golden break).

REF authoring: frozen literals with derivation expressions (`0.07/(0.5*0.5)` etc. — the VENUS_REF `0.815/(0.95*0.95)` pattern); for the tidal slots, derive inline from the preset orbital constants the way plates derives `EARTH_TIDAL_HEATING` (plates.js:96-103) rather than hand-typing `136.74504375182553`. No cross-import from driver-presets.js (base/ writers take no cross-imports — the stated VENUS_REF/MAGMA_REF rule).

**Seed-stability rule (new, shell-specific):** the builder must NEVER read `condition.radiusEarth` — it is the DRAWN radius (`state.planetRadiusEarth` in the lab, fp fallback headless; v2-0-carrier-golden.mjs:71-72), so it varies per seed for seeded archetype worlds. All other candidate slots (flat massGravity/volatileFraction/tidalHeating from `deriveUniforms(fp)`; nested T_eq/age/shellThickness from fp) are fp-stable. Add `radiusEarth` to the AC-0 grep denylist.

---

## 3. Proposed response axes (all research-gate-free)

The stress math (Melosh/Beuthe despin, Hoppa/Beuthe diurnal — pinned from research workflow wccpy01ez per the file header) stays **frozen**; like V2-2b-1 (which reused increment-4b-MECHANISM.md and deferred no research), V2-5s only re-tunes population/threshold/amplitude knobs the mechanism already renders. No new science gate.

- **A1 — gravity → relief amplitude (THE HEADLINE — the §3.1 row's named axis).** `gFactor = clamp(0.4, 2.5, (massGravity/REF.massGravity)^-0.5)` — the exact house convention (plates.js:137, magmatism.js:119) — multiplied onto `RIDGE_AMP` (STEP-3 `lineamentRelief`) and `CHAOS_AMP`+`CHAOS_BASE` (STEP-4). One-liner: *maximum supportable relief ∝ 1/g (isostasy + crustal yield strength)* — the same shipped law, now on ice. Low-g Titan-class → pronounced ridging; high-g Eyeball-class → subdued. At `g === REF.massGravity`, `pow(1,-0.5) === 1` → `RIDGE_AMP·1 === RIDGE_AMP` exactly (IEEE) → null-guard-safe, same as plates.
- **A2 — rawTidal → lineament density.** `tidalDev = clamp(-1, 1, log10(max(tidalHeating, ε) / REF.tidalHeating) / SPAN_DECADES)` → `CREST_THRESH` down within a clamp (≈[0.85, 0.98]; STEP-3 crack-network density, `:309`) and optionally `TENSILE_THRESH` down (more area passes the crack gate, `:81`). One-liner: *crack population tracks peak diurnal stress against ice tensile strength — Europa's cycloid/lineament density scales with tidal flexing* (the Hoppa-1999 physics already pinned in STEP-1b). Log-ratio because within-regime raw Io-ratio spans ~10 decades (Titan 1.6e-8 → Europa 1.4e2); a linear or `clamp01` deviation either dies or saturates (the ROADMAP :90 note on raw-tidal saturation). `log10(REF/REF)=0` exactly → null-safe.
- **A3 — thermal vigor (nested `condition.T_eq`, + flat vf) → convection-cell population.** `CELL_MIN` within a clamp (STEP-2, `:194`) — the direct analog of plates `PLATE_COUNT_MIN` (th↑→plates↑) and stagnant `CORONA_POOL`/`PLUME_MIN`. One-liner: *warmer / more-volatile → thinner convecting shell → higher Rayleigh number → finer convection planform (cell wavelength ∝ shell depth)*. Structurally inert on `eyeball-despun` (CHAOS_W 0 skips STEP-2) — physically correct: no convecting shell.
- **A4 (optional) — T_eq → chaos area on icy-active.** `CHAOS_THRESH` down for warmer shells (STEP-4 `chaosMask`): *warmer shell → more melt-through chaos terrain (Europa chaos)*. Could fold into A3's vigor signal; in-or-out is a taste call (§7).

**Deliberately NOT proposed:**
- `condition.shellThickness` as A3's signal — physically the cleanest (it IS the shell depth) and available in the vector, but its Eyeball REF slot is a derived decimal (`0.40498676979442294`, from baseStep `deriveBodyScalars`) — an ugly frozen literal with real drift surface. Recommend T_eq/vf vigor first-cut, with shellThickness optionally behind a zeroable gain (`K_SHELL = 0` opt-in — the V2-2b-1 `K_G = 0` precedent, contract designDecision #7).
- **age** — plates descoped it on Max's explicit UAT call 2026-06-28 ("age IS history — its real home is the epoch/host-editor model", plates.js:110-112). stagnantLid used `condition.age` only as a headless-only limb. Keeping V2-5s age-free avoids re-litigating a decision Max already made.
- `DESPIN_REF`/`DIUR_REF`/`DIUR_PEAK` — calibration constants: DIUR_REF is explicitly tuned so raw despin/diurnal magnitudes match and "REGIME_WEIGHTS act as intended" (`:76-79`); DIUR_PEAK is the analytic normalizer term (`:80`). Tuning them silently re-balances regime character = between-regime clobber.
- `REGIME_WEIGHTS` — regime identity itself; not in the tune seam and should stay out.

---

## 4. Population-knobs vs load-bearing discipline

shellRelief has **no `BASE_*` floors** (the V2-2b-1 anti-mush anchor); its structural equivalents are:
1. **The double-ridge cross-section shape** — `SHOULDER_HT`/`TROUGH_DEPTH` (`:87-88`) set the shoulders-vs-trough profile. Never returned by the tune; A1 scales the whole profile via `RIDGE_AMP` (which multiplies `doubleRidge` wholesale, `:313`), so ridges stay double-ridged at every drive level.
2. **Stress-organization beats latitude** — the shipped falsifier (`varExplainedByStress > varExplainedByLatitudeY/W0`, shellProbe + the structure suite's arm's-length predictors). The tune touches no latitude machinery and never removes the `max(0,σ)` tension gate, so this is preservable structurally; AC-ORDER asserts it across the sweep anyway.
3. **The stress field itself** — proposed keys touch neither `stressTensile` nor `thetaTraj`, so `carrier.grainAngle` + `faultDensity` (two of the five hashed golden fields) stay byte-stable even under drive; only `height` (+ lineament/chaos diag) responds. Nice blast-radius property; worth stating in the contract.

| safe tune targets (population/threshold/amplitude-within-band) | load-bearing — never returned |
|---|---|
| `CELL_MIN` (count, clamped; `CELL_SPAN` optionally) | `DESPIN_REF`, `DIUR_REF`, `DIUR_PEAK` (STRESS_REF calibration / regime balance) |
| `CREST_THRESH`, `TENSILE_THRESH` (crack density gates, clamped) | `SHOULDER_HT`, `TROUGH_DEPTH` (cross-section shape) |
| `CHAOS_THRESH` (chaos area gate, clamped) | `SHELL_BASE` (datum), `RELAX_PASSES`, `SHELL_BOUND` |
| `RIDGE_AMP`, `CHAOS_AMP`, `CHAOS_BASE` — via ONE common `gFactor` | `BELT_RADIANS`, `WARP_FREQ/AMP`, `DETAIL_*`, `RIDGE_FREQ`, `CHAOS_FREQ` (resolution/texture calibration) |
| | `REGIME_WEIGHTS` (not in the seam; regime identity) |

Amplitude note: this is deliberately MORE than V2-2b-1 (which deferred gravity behind K_G=0 because its floors made amplitude-touching risky) and LESS than a free re-tune — plates.js:137-139 is the direct precedent for gFactor-scaled amplitude gains, and here gravity is the increment's *headline* axis so it cannot be deferred. Key-set assertion (mirror AC-ORDER-PRESERVED): the returned object ⊆ the enumerated safe set, no other `SHELL_DEFAULTS` key ever.

Determinism note: a `CELL_MIN` override changes the number of `alea('shell:cells:')` draws — deterministic per (seed, tune), byte-safe at null tune (identical to stagnant's `CORONA_POOL` moving the accept-loop draw count).

---

## 5. Lab surface

Idiom (grep-verified, planet-lod-lab.html):
- Override state `driverOv` + `_driverTouched` + `_driverAbMode` (`:2684-2686`); `buildBodyDrivers` overlay (`:2725-2747`) — touched sliders override flat slots; the V2-2b-1 `tsurf` control overlays **nested** `condition.T_eq` (`:2731-2732`), the sanctioned pattern for any new nested override.
- Folders: `fBodyDrivers` (`:3834` — gravity/volatiles/tidal sliders + A/B + mode readout), `fMagmaDrivers` (`:3857` — thermal), `fStagnantDrivers` (`:3870` — tsurf). Each new folder = ~8 lines reusing the same plumbing.
- **Free lever already installed:** the existing gravity + tidal sliders write the FLAT `massGravity`/`tidalHeating` slots the shell builder will read — dragging them on Europa/Titan/Eyeball becomes live shell response with zero new sliders. The `:2682` comment ("these sliders ONLY affect the plate-path presets … inert on every other preset") goes stale and must be updated in the same commit.
- New for V2-5s: an `fShellDrivers` folder (mirror fStagnantDrivers) grouping the shell A/B + any new vigor override; `shellProbe()` (`:6096-6172`) extended with `appliedTune` — it already returns the response observables an AC-LAB sweep needs (`cellCount`, `lineamentNodeCount`, `varExplainedByStress`, `lineamentInteriorRatio`, full `U` for std(U)).
- **File-conflict check (verified 2026-07-12):** `git status --porcelain -- planet-lod-lab.html planet-lod-rivers.js src/worldengine/base/shellRelief.js` → clean (only `src/auto/CameraChoreographer.js` + `src/debug/LabMode.js` are modified in the tree, unrelated). The concurrent **V2-7d (lidDisruption)** workstream is fenced OFF this file set: its contract `:116` — "shellRelief.js, stagnantLid.js, mixedInterior.js, magmatism.js, plates.js, tectonic.js, lidResponse.js, e1Regime.js all UNTOUCHED (zero existing-src/ modifications is the increment's hard diff fence)"; shellRelief STEP-2 is its read-only seed #1 (`:102`). No overlap with V2-5s's file set (shellRelief.js, planet-lod-rivers.js, planet-lod-lab.html, tests, workstream docs).

---

## 6. Proposed AC surface (template: docs/WORKSTREAMS/world-engine-v2-2b-1-stagnant-response-2026-07-04/contract.json)

- **AC-0** — spine conformance (Rule 15): builder reads ONLY D-slot-backed channels — flat `massGravity`/`volatileFraction`/`tidalHeating` + nested `condition.T_eq` via optional-chaining with per-regime REF fallback (never-throw); grep denylist: no archetype string, no e1 label, no `shellRegimeOf(`, **no `condition.radiusEarth`** (the drawn-radius seed-stability rule, §2); the regime ARG is declared as dispatch-provided derived context (same tuple the writer's `REGIME_WEIGHTS[regime]` consumes), selecting the REF only. Named consumer per knob: `CELL_MIN`→`cellCount`, `CREST_THRESH`/`TENSILE_THRESH`→`lineamentNodeCount`, `RIDGE_AMP`/`CHAOS_AMP`→std(U)/`lineamentInteriorRatio`, `CHAOS_THRESH`→chaos-area — all in `shellProbe` + the structure suite; `appliedTune` reader = shellProbe + AC-LAB. Taxonomy: sliders are driver overrides, no `*Enabled` key. Unit, not live.
- **AC1** — determinism + zero new RNG: builder pure (zero alea/Math.random/Date.now — DEFAULTS-override only); writer stays in its disjoint `'shell:'` namespace with `'lid:'` still reserved; repeat builds byte-equal per (drivers, seed); `|U| < SHELL_BOUND`. Unit.
- **AC-TUNE-NULL** — the byte anchor ×3: (a0) `shellDriversToTune(null, r) === null` and `({} , r) === null` for every regime; (a) `shellDriversToTune(SHELL_REFS[r], r) === null` per regime; (b) NON-CIRCULAR: for each of Titan/Europa/Eyeball, construct the LIVE bundle (`buildNeutralBodyDrivers(deriveUniforms(fp), fp)` + `deriveConditionVector`) and assert null; (c) every REF read slot `===` its live-derived slot to full float precision (the table in §2); (d) a perturbed vector returns a non-null override. Unit.
- **AC-BYTE-SHELL** (or ×3 per preset) — "null tune === omitted tune": dual fresh carriers per mesh, shipped call (`grainDrivers`, no tune) vs new call (bodyDrivers + `tune: shellDriversToTune(REF, r)` /\*null\*/), typed-array equality of `height` + all shell diag arrays + equal `cellCount`/`lineamentNodeCount`, 3 presets × seeds {1,2,3,7,42}. Unit.
- **AC-TUNE-RESPONSE** — the MULTIPLY core: fixed seed, per-axis monotone correct-sign sweeps — g↓ ⇒ std(U)/lineament amplitude ↑ (A1); tidal↑ ⇒ `lineamentNodeCount` ↑ (A2); vigor↑ ⇒ `cellCount` ↑ (+ chaos area ↑, A3/A4) — measurable above a set noise floor, no sign inversion; at each REF the field collapses to the shipped preset. Sweeps stay within each axis's clamped valid domain (the AC3-scope lesson from V2-2b-1). Unit.
- **AC-VARIETY** — the D2-MF5 objective proxy ("driver-varied worlds differ, measured how"): at a FIXED seed, two driver vectors in the SAME regime differ on a composite observable vector {`lineamentNodeCount/N`, std(U), chaos-area-fraction, `cellCount`} by more than a per-observable noise floor, where the floor = each observable's spread across the 5 seeds at fixed drivers (the V2-2b-1 delta-H-min discipline); the seed-only baseline stays within the floor. Directly instantiates "low-g vs high-g icy worlds differ within-regime". Unit.
- **AC-ORDER** — anti-mush, structural: across every sweep point (i) `varExplainedByStress > varExplainedByLatitudeY` AND `> varExplainedByLatitudeW0` (the shipped falsifier stays green under tune — the shell analog of stagnant AC3's "tuned world stays plume-organized, not latitude-banded"); (ii) `lineamentInteriorRatio > 1` (lineaments stay the relief-carrying structure); (iii) key-set assertion — the returned tune contains ONLY the enumerated population/amplitude keys, never `DESPIN_REF`/`DIUR_REF`/`DIUR_PEAK`/`SHOULDER_HT`/`TROUGH_DEPTH`/`SHELL_BASE`/`RELAX_PASSES` (ordering preserved by construction). Unit.
- **AC-ZERO-CLOBBER** — integration: (a) 75-golden 75/75 green (three shell presets null at their REFs; Frozen routes despun so no fourth row can move — verified); (b) shell's own suites green (tests/worldengine-base-shell-structure.test.js, tests/worldengine-shell-regime-gate.test.js) + the V2-3 dispatch-oracle + taxonomy suites; (c) plate/volcanic/stagnant/despun byte-identical (dispatch edit confined to the two shell call sites; `grainDrivers→bodyDrivers` swap is byte-safe, writer voids drivers); (d) diff fence: ONLY shellRelief.js, planet-lod-rivers.js, planet-lod-lab.html, new/updated shell tests, workstream docs — NOT plates/magmatism/stagnantLid/lidResponse/mixedInterior/e1Regime/body-drivers/body-condition-vector/driver-presets (and not V2-7d's new module); (e) `'lid:'` reserved; (f) the 4 known failures don't grow. Integration, not live.
- **AC-LAB** — live integration (agent-drivable, mirror V2-2b-1 AC-LAB): fresh tab, Europa preset (routes shell icy-active), setSeed, reliefBakeStrength 1; TRUE baseline first (A/B 'preset' mode) → `shellProbe().appliedTune === null` + unchanged observables; then drag gravity low/high and tidal low/high, force a route each time → `appliedTune` non-null with moving `lineamentNodeCount`/`cellCount`/std(U) in the correct directions; screenshots both ends; repeat one axis on Titan (volatile-cold) to show the second regime responds about its own REF. Close pages after (window hygiene). Integration, live.
- **AC-UAT** — **RECOMMEND: YES, exactly 1 UAT AC**, deferred-to-max, never PASSed by an agent. Precedent: V2-2b-1 carried exactly one, on the BETWEEN-world criterion, and Max passed it 2026-07-05 ("it looks distinct along these axes the sliders control"). V2-5s's criterion is Max-facing by nature — the north-star D2-MF5 gap is *visible* within-regime variety: "a driver-varied icy world (low-g vs high-g at the same seed) reads as a genuinely different icy world — not a re-rolled Titan/Europa." Carry the V2-2b-1 honesty flag verbatim-in-spirit: the three shipped presets stay byte-identical, so Max judges *the response space exists on driver-varied worlds*, NOT "Titan changed". Within-WORLD sameness stays out of scope — the AC11 UAT feedback ("crude/samey-within-world") was explicitly routed to V2-7/V2-8/V2-7d (ROADMAP :146), not V2-5s.

---

## 7. Risks + open questions

**Technical-default (proceed; report, don't ask):**
1. Builder signature grows a `regime` arg (precedents are unary). Justified in §2; declare in AC-0. Fallback for unknown regime = icy-active REF (writer parity).
2. Log-ratio tidal transform is a new transfer shape (precedents use linear/clamp01 deviations). Required by the 10-decade within-regime span; clamped, pure, exactly 0 at REF. Flag it in designDecisions.
3. REF authoring for the tidal slots: derive inline from preset orbital constants (plates.js:96-103 `EARTH_TIDAL_HEATING` precedent) rather than hand-typed decimals; AC-TUNE-NULL(c) pins any drift either way.
4. Stale lab comment `:2682` (existing sliders "inert on every other preset") must be updated when shell starts reading the flat slots.
5. `CELL_MIN` tune changes `'shell:cells:'` draw counts — deterministic per (seed, tune); CORONA_POOL precedent. Non-issue, but name it in AC1 so a reviewer doesn't mistake it for a determinism break.
6. Concurrent V2-7d: zero file overlap now (hard fence, §5). Post-V2-7, if the shared lidDisruption module ever absorbs shellRelief STEP-2, the `CELL_MIN` tune key must migrate with it — record as a deliberate non-goal / forward note in intent.md, not scope.
7. Sweep validity domains: clamps on each axis (the AC3 cold-limb lesson from V2-2b-1 — assert monotonicity only inside the clamped domain, and document the out-of-domain behavior instead of claiming it).

**Genuinely-Max (taste — surface at scope interview):**
1. **The honesty-flag framing**: shipped Titan/Europa/Eyeball do NOT change; within-regime variety lands on driver-varied worlds (sliders now; seeded icy archetype worlds get it for free since their derived conditions differ per world). Max accepted this exact framing for V2-2b-1 (designDecision #10) — confirm it again for the icy family.
2. **Axis palette**: is gravity + tidal + thermal-vigor the right first cut, or should the volatile axis foreground the cantaloupe-vs-crack balance on volatile-cold worlds? (Gains are first-cut/UAT-tunable regardless — the ACs assert sign + measurability, not magnitudes.)
3. **A4 (chaos-area response) in or out** — how busy warm icy-active worlds should get is a look call.
4. **shellThickness axis now vs deferred** behind `K_SHELL = 0` (the K_G precedent) — recommend deferred (REF-literal ugliness, §3), but it is the physically purest signal and Max may want it live.
