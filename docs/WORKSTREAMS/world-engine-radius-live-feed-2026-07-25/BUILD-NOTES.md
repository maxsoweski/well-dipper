> ⚠⚠ **SUPERSEDED IN PART (gravity-selfcompression-2026-07-28) — THIS BANNER COVERS THE WHOLE
> DOCUMENT, including everything above and below it.** Any statement that
> `surfaceGravity = g_c·(R/R_c)`, or that g is monotonic in R by that law, records the
> CONSTANT-DENSITY law live when this document was written. Gravity is now `g = g_c·f(R)/f(R_c)`,
> `f` piecewise in ABSOLUTE Earth radii (`R^(4/3)` below 1 R⊕, `R^1.70` above), **rocky class
> only**; gas/icy/carbon unchanged. Byte-exactness at canonical is unchanged. Audit trail.

# BUILD-NOTES — world-engine-radius-live-feed-2026-07-25 (R1: THE REWIRE)

**Status:** built, gates green, **nothing committed** (working tree only, per the build brief).
**Branch:** `feature/world-engine-production-L1`.
**Scope:** the *feed*, not the physics. Five of six frozen-radius sites now read the drawn radius;
the sixth stays canonical on measured evidence. No physics law was changed anywhere.

Line of sight to the driving outcome: Max's directive was *"Tectonics, craters, everything need to
adjust to the new radius when adjusted. I can tell that's not happening across the board."* The
census split that into three problems; this is the cheapest real one — the atmosphere's Rhines band
law was already correct and was being fed a number the slider never moved. After this change,
dragging radius on a Jovian moves the Rhines wavenumber from 2 to 15 across the slider (measured,
headless, seed 7). R2 — volcanism's plume population and the five radius-blind tectonics modules —
is untouched and still named as a non-goal.

---

## 1. AC-0 — DOES / UNLOCKS card

### What it DOES (each rewired consumer × the driver it now reads × what the player sees)

| # | Site (current line) | Consumer | Driver it now reads | What the player sees |
|---|---|---|---|---|
| 1 | `world-engine-lab.html:2863` `rebakeE5Bands` | E5 climate writer `drivers.radius` → LAW 1 Rhines wavenumber `m` | `_gcond.radiusEarth` — the condition vector (`deriveConditionVector(_fp, _gu, state.planetRadiusEarth)`, :2851) | Number and spacing of visible zonal bands on a gas/ice giant |
| 2 | `world-engine-lab.html:2947` `applyStormState` | storm-E writer `drivers.radius` → PV staircase the vortex argmax rides | `_scond.radiusEarth` — same condition vector (:2930) | Latitudes the great spot / ovals / barges are placed at |
| 3 | `world-engine-lab.html:3306` `applyDrivers` | `state.bandCount` → `uBandCount` → F25 `jetU` / `jetShearGate` / festoon window | `state.planetRadiusEarth` (no condition vector in scope — declared) | Jet-profile stripe frequency, shear gating and festoon scalloping (visible only with Jets on) |
| 4 | `world-engine-lab.html:3409` `applyDrivers` | `state.cloudRegime` (the hazy sub-Neptune branch) | `state.planetRadiusEarth` (declared, as above) | Which cloud combiner runs: hazy sub-Neptune deck vs the giant band stack |
| 5 | `world-engine-lab.html:3564` `applyDrivers` | `_giantDynamo` → `state.auroraIntensity` / ring latitude / ring width | `state.planetRadiusEarth` (declared, as above) | Whether a giant lights a metallic-/ionic-envelope aurora oval, and how tight it is |
| — | `world-engine-lab.html:5206` `worldDefaultEnableSet` | `craterRelevanceOf` boot-enable | **stays canonical `_fp.radiusEarth`** — proven inert | (no change — proven it cannot differ) |

Driver connectivity (check 1): every one of the five reads the same D-slot-backed quantity —
the drawn body radius the slider writes — either through `deriveConditionVector` (the ratified single
source, which also carries the coherent gravity `g = g_c·(R/R_c)`) or, where no condition vector is in
scope, directly off `state.planetRadiusEarth` with an inline comment saying so. No new driver, no
archetype-string routing, no new debt.

Named consumer (check 2): no field is emitted that nothing reads. Every site is a *consumer-side*
repair — the emitted fields (`aBand`/`aShear`/`aMush`, `uBandCount`, `state.cloudRegime`,
`state.auroraIntensity`) all had readers before and still do. `uBandCount`'s readers were
**re-established by measurement**, not assumed — see §3.

Taxonomy registration (check 3): **no new lab control, preset, or feature.** Nothing to register;
`planet-archetypes.js` untouched; `tests/planet-archetypes.test.js` unchanged and green. No new file
under `src/`, so Rule 14 `Module(s):` registration does not apply (the two new files are under
`tests/`).

### What it UNLOCKS

- **Immediately:** AC-BANDS' live A/B and Max's AC-UAT gate become possible at all — before this,
  any radius A/B on a giant was guaranteed to show zero difference.
- **Downstream:** the storm/vortex placement (#3b) and the F25 jet geometry now ride the same live
  radius as the band bake, so the whole giant stack stays coherent under the slider instead of
  drifting apart. That coherence is the precondition for any later increment that reads jet latitude.
- **R2 hand-off:** the census's *feed* problem is closed and fenced; what remains under Max's
  directive is genuinely missing physics (volcanism population, five radius-blind tectonics modules)
  plus vertical km calibration — not more wiring.

---

## 2. What changed, site by site

All six edits are in `world-engine-lab.html`. **No `src/` file was modified.**

**1 & 2 — E5 band bake (:2863) and storm bake (:2947).** `(_fp.radiusEarth ?? 1) / 11.2` →
`(_gcond.radiusEarth ?? 1) / 11.2` and `(_scond.radiusEarth ?? 1) / 11.2`. Both functions already
derive a condition vector from `state.planetRadiusEarth` one line above the frozen read, so the fix
is literally "stop bypassing the source that already has it" (contract designDecision 2). Rewired
**together on purpose**: the storm writer places vortices on the shear argmax of the staircase the
band bake produced, so a frozen radius in one against a live radius in the other would put vortices
at latitudes the bands no longer sit at.

**3 — `state.bandCount` (:3306).** `_fp.radiusEarth` → `state.planetRadiusEarth`. `applyDrivers` has
no condition vector in scope (`buildBodyDrivers` and `rebakeE5Bands` each derive their own, and
`state._lastBodyDrivers.condition` is debounce-stale here), so this reads the state field directly and
the comment says so.

**4 — cloud regime (:3409)** and **5 — giant dynamo (:3564).** Same substitution, same reason, same
declared comment. Thresholds (`< 6`, `>= 3.5`) are unchanged; only the number fed to them moves.

**6 — crater boot (:5206). NOT rewired.** The `_fp.radiusEarth` read stays. Its old justification
("R-stable within a preset") was true but under-argued and unreferenced; it is replaced by the
measured mechanism, a pointer to `evidence/G2-craterboot-sweep.md`, a `RADIUS-CANONICAL-BY-PROOF`
marker, and an explicit statement of what the proof depends on.

---

## 3. Findings that changed what got built

**`uBandCount` is LIVE, and `docs/NOW.md` is half-wrong about it.** The ground-truth phase established
by static call-graph closure (GLSL has no indirect dispatch, so reachability is decidable) that
`uBandCount` still reaches rendered pixels through `planet-lod-height.glsl.js:1518` (`jetU`), `:1530`
(`jetShearGate`) and `:1570` (the festoon window), behind exactly one gate: `uJetStrength > 0`
(gas preset **and** the Jets checkbox). Two independent roots reach it, and one of them — the
jets-solo path at `world-engine-lab.html:680` — deliberately bypasses `bandMask`, so it is *not* gated
by `bandStrength`. What the atmo increment actually retired was only the band-VALUE consumer.
**Consequence for this build:** `state.bandCount` was rewired rather than deleted. **Consequence for
UAT:** an A/B taken with Jets OFF will show zero difference at this site — that is not "the rewire did
nothing". **Recommended NOW.md correction (not applied here — see §7):** *"uBandCount retired as the
band-value ladder (bands now authored by climate-e5's aBand); it survives as the F25 jet/shear/festoon
stripe frequency behind uJetStrength > 0."*

**The five-site rewire is a four-site rewire plus one proven exemption.** `craterRelevanceOf` was
swept for all 18 presets: zero flips, and no continuous margin closer than 18× to any decision
boundary. Stronger than the table: the predicate's own clamps bound any possible flip at
`R_flip_max = 0.133 R⊕`, **2.03× below the true reachable radius floor of 0.27**. Rewiring `:5206`
would have been churn against measured evidence.

> **Corrected 2026-07-25 (lens round).** This originally read "2.26× below the slider floor of 0.3",
> and the sweep ran over `[0.3, 16]`. Wrong floor: the lab's draw site passes `{ labUnlock: true }`
> and `LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)'] = [0.27, 0.38]`, of which **27.1% of seeds
> land below 0.3** — outside the swept domain. Re-swept over the reachable `[0.27, 16]` (18 × 501):
> still zero flips, so the disposition holds; only the number was wrong. See §Lens round, finding G2.

**Rivers were law-audited, not rewired.** Their feed is already live; the width law is exactly
`clamp(1/R, 0.08, 2.5)` — an *on-screen-constancy* law, the opposite frame from craters' physical
count. Under Max's ratified frame that is arguably correct, so nothing was touched. Recorded here so
no later agent "fixes" it to match craters (that is planted defect D2 in `evidence/G3`).

---

## 4. Deviations from the build brief, with justification

1. **The prompt listed `:2856 / :2935 / :3278 / :3370 / :3521 / :5146`; the live line numbers are
   `:2863 / :2947 / :3306 / :3409 / :3564 / :5206`.** The brief said to verify line numbers against
   current source; they had shifted only because of the comments this build added above them. Same
   sites, same expressions.

2. **`:5146` (now `:5206`) was NOT rewired.** Directed by the brief itself ("DISPOSITION SET BY G2")
   and by the measurement. Recorded as a deviation from the naive "five-site rewire" framing.

3. **The cloud-regime gate's `massEarth` co-driver was left frozen — deliberately, and recorded.**
   Under the ratified V2-6 frame the slider means "a bigger body of the same composition", so a
   coherent mass would be `M_c·(R/R_c)³`. The condition vector does not surface `massEarth`, and
   re-deriving it here would change the gate's stated semantics (AC-REGIME names the radius term
   only). **Consequence:** away from canonical radius the `(R, M)` pair the gate sees is physically
   incoherent. **Flagged as an R2 candidate, not silently accepted.**

   > **Corrected 2026-07-25 (lens round) — the original wording of this item was wrong twice over.**
   > It claimed the incoherence "changes no outcome today", that it lives "at large drawn radii", and
   > that "a test pins that claim". Measured against the note's own coherent form `M(R) = M_c·(R/R_c)³`,
   > over 4001 log-spaced radii on the slider's travel, the frozen and coherent masses give
   > **different** regime verdicts on every gas preset, and the whole disagreement band lies **below**
   > the 6 R⊕ radius term: Neptunian `[0.300, 3.261]`, Sub-Neptune `[2.885, 5.998]`,
   > Jovian `[0.300, 3.534]`, Saturnian `[0.300, 4.433]`, Hot Jupiter `[0.300, 3.800]`. Both
   > ice-giant-class presets draw from `[2.5, 4.0]`, so the band is reachable by an ordinary reroll,
   > not just by dragging. The cited test also did **not** test the proposition — it only asserted that
   > the as-shipped frozen code has one behaviour, which is true no matter how wrong the claim is.
   > The co-driver is still left frozen (R1 rewires the feed, not the law), but the divergence is now
   > pinned by a real test: `tests/radius-live-feed.test.js` → *"CORRECTED CLAIM: the frozen mass DOES
   > change the verdict, and it does so BELOW 6 R⊕"*.

4. **A third test surface was added inside `tests/radius-live-feed.test.js`** rather than a third
   file, so the brief's gate command (`npx vitest run tests/radius-live-feed-fence.test.js
   tests/radius-live-feed.test.js`) still covers everything. It is the `AC-CRATERBOOT` describe block.

5. **The E5 band-count monotonicity criterion was corrected mid-build — the threshold was wrong, not
   the code.** See §5.

6. **Not done in this build (belongs to the next step, not silently dropped):** `AC-CENSUS`
   (`RADIUS-CENSUS.md` update), the `docs/NOW.md` correction, and the live browser A/B for AC-BANDS /
   AC-REGIME / AC-RIVERS. The brief scoped this agent to the rewire, the tests and the gates.

---

## 5. Self-correction: visible band count is NOT monotone in radius

The first draft of `tests/radius-live-feed.test.js` asserted that the E5 writer's `bandCount` is
monotone non-decreasing in radius. **It failed, and the assertion was wrong — not the code.**

`bandCount` counts **zero crossings** of the composed jet profile (equatorial Gaussian + Ward
envelope + alternating mid-jets). When the Rhines wavenumber `m` increments, the outermost lobe can
lose its crossing before the pole, so the count can drop by one even as the physics grows.

Characterised **before** setting a bound — 5 regimes × 4 seeds × 400 radius steps:

| quantity | monotonicity violations | max drop |
|---|---|---|
| `m` (Rhines wavenumber, LAW 1 output) | **0** everywhere | — |
| `jetCount` | **0** everywhere | — |
| `bandCount` (visible zero crossings) | 0–2 per sweep | **always exactly 1** |

So the honest invariant is a *bounded wobble*, not monotonicity. The test now asserts: `m` and
`jetCount` monotone non-decreasing (exact), `bandCount` never falls by more than 1 per step and at most
3 times per sweep, and the endpoints still climb hard.

**State this at UAT so it is not read as a bug:** on a Jovian there is one spot near the m = 7 → 8
change (R ≈ 3.8 → 4.1 R⊕) where dragging radius *up* shows **one fewer** visible band before the count
resumes climbing. That is the profile's parity, not a broken feed. This behaviour is a property of
climate-e5 and is independent of where `m`'s radius comes from — it was simply unobservable while the
feed was frozen.

---

## 6. Tests written

### `tests/radius-live-feed-fence.test.js` — AC-NOFROZEN (42 tests; was 34 before the lens round)

Source-greps `world-engine-lab.html` for `radiusEarth` reads on a frozen preset source
(`_fp`, the bare `fp` alias, or a `DRIVER_PRESETS[…]` subscript; `.` or `?.`, whitespace/newline
tolerant).
**Comment-inclusive by design**, following `tests/vis-scale-fence.test.js` — commented-out code is one
uncomment away from live. The cost is that prose about the defect trips the fence, so the lab's own
rewire comments say "the frozen preset constant" in words.

- **Allowlist:** exactly one entry (`craterboot-worldDefaultEnableSet`), carrying a stated proof and a
  pointer to `evidence/G2-craterboot-sweep.md`. Three meta-tests enforce that the allowlist cannot
  rot: every entry must still match a real line, every entry must actually cover a deny hit (a stale
  entry is deleted, not tolerated), and every entry must carry a >40-char reason plus a
  `docs/WORKSTREAMS/**.md` evidence path.
- **Non-vacuity:** asserts the scan still *finds* the allowlisted site (guards against a regex that
  silently stops matching and goes permanently green).
- **MANDATORY NEGATIVE CHECK — seven planted defects, run every invocation.** Each takes the real
  current source, re-freezes one rewired site by string substitution, and asserts the scanner reports
  it; then re-asserts the unmodified source is clean. Break ⇒ FAIL, restore ⇒ PASS, in-process.
  The seventh (added in the lens round) re-freezes `buildBodyDrivers`' condition vector through the
  **bare `fp` alias** — the third frozen-preset spelling the fence originally could not see.
- **Instrument control on the scanner itself** (added in the lens round): an offender planted at the
  very start of the source must still be found *after* the `.test()` sequence that used to leave the
  shared `/g` regex's `lastIndex` at 122. Fails on the old scanner, passes on the fixed one.
- **Deny-pattern precision:** 11 forms that must match, 12 that must not (`state.planetRadiusEarth`,
  `_gcond.radiusEarth`, `_bodyDrivers.condition.radiusEarth`, `o.radiusEarth`, the
  `radiusEarth: 1` object-literal key, `_fp.massEarth`, `gfp.radiusEarth`, `fp.T_eq`, …).
- **AC-0 source pins:** each of the five rewired sites must match its live expression, both
  `deriveConditionVector` calls in the giant path must be fed `state.planetRadiusEarth`, and exactly
  one `deriveConditionVector` call may still be fed a canonical radius.

### `tests/radius-live-feed.test.js` — AC-BYTE / AC-REGIME / AC-CRATERBOOT / AC-BANDS headless half (43 tests; was 34)

**Method: source execution, not re-implementation.** The rewired consumers live inline in
`world-engine-lab.html`, so the suite *cuts each expression out of the live source at run time and
executes it* with the lab's own local identifiers in scope. Every extraction throws a loud, explicit
error if its pattern stops matching, so "the source changed shape" surfaces as a hard failure rather
than a silently-vacuous green. The lab's own `_gas` gate and `_rotH` read are extracted too, so the
harness cannot desynchronise from the site under test.

**Every check carries a planted defect.** For each site the FROZEN form is reconstructed *from the
live source* by one substitution and pushed through the identical harness; it must fail the response
criterion the live form passes.

Instrument controls (the flip detector, before it is used as evidence): NEG — a constant reports no
flip; POS — known steps at R = 4 and R = 6 are found and localised to 1e-9 relative (the 64-step
geometric bisection converges to ~2^-64 of the bracket, so 1e-9 is ~9 orders of headroom); plus a
check that the sample grid really spans `RADIUS_SLIDER_MIN … MAX`.

Stated criteria, per site:

| check | criterion | why that threshold |
|---|---|---|
| canonical byte-inertness (all 4 rewired sites, all 18 presets) | exact equality (`toBe`) against a **literal table captured from `git show HEAD:world-engine-lab.html`** | AC-BYTE demands bit-inertness, so no tolerance is admissible. **REWRITTEN in the lens round:** the original version derived its "frozen" oracle by substituting one symbol for an equal-valued symbol in the live source, which is an algebraic identity and passed even on a fully dead feed. A literal captured from the prior build cannot inherit the live source's defects; falsifiability is proven by four planted defects |
| boot-radius delta (the whole `AT THE RADIUS THE LAB ACTUALLY DRAWS` block) | exact per-preset tables at `drawPresetRadius(p, radiusSeed, { labUnlock: true })`, seed read from source; exact flip counts over seeds 0…2000 | this is the radius the lab operates at, and nothing tested it before. Exact integers/booleans because the draw is deterministic; the seed-sweep counts are pinned so a threshold nudge invisible at canonical radius still fails |
| E5 radius driver | `=== R/11.2` exactly, at every R | a single division by a literal — any deviation means it is reading a different number |
| giant driver triple radius-independence | bit-exact across the slider, all 5 regimes | this is what makes N ∝ √R an *identity*; `drawGiantConditions` back-solves gravity so `M = g·R²` cancels R |
| LAW 1 form | `rhinesWavenumber === max(M_MIN, round(RHINES_K·√(aΩ/U)))` exactly | pins the law, not a sample |
| LAW 1 exponent | `n(4a)/n(a) === 2` to 1e-12 relative | U is radius-independent (pinned above) so the ratio is algebraically 2; 1e-12 is ~4 orders above float64 round-off. **No power-law fit is used** — fitting over a handful of driver values would give dof = N−2 and a t = 12.71 multiplier at dof = 1, i.e. a wide interval standing in for an exact result |
| `state.bandCount` Jovian | exact integers: R = 11.2 → 14, R = 5.6 → 7, R = 0.3 → 3 (clamp), R = 16 → 16 (clamp) | the quantity *is* an integer; hand-computed from the source law at rotationHours 9.9 |
| `state.bandCount` response | ≥ 8 distinct values across the slider, monotone non-decreasing | the unclamped law spans 0.36 → 19.4 and the 3..16 clamp admits 14 integers; 8 is a conservative floor no rounding pattern meets by accident |
| E5 end-to-end (Jovian, seed 7) | `m` 2 → 15, `band` 2 → 13, `jet` 4 → 16 exactly; `m` ratio ≥ 5 | climate-e5 is deterministic (no `Math.random`/`Date.now`), so exact integers are reproducible; predicted ratio √(16/0.3) = 7.3×, measured 7.5× (the excess is the M_MIN = 2 floor). A dead feed returns a ratio of exactly 1.0 |
| cloud regime | exactly one flip, 2 → 0, at the threshold **extracted from source**, within 1e-9 relative; and no other preset flips at all | AC-REGIME's observable is "the crossing radius matches the constant in source" — so the constant is read out of the source rather than typed here |
| giant dynamo | all 5 gas presets flip exactly once at the source cutoff (3.5); no non-gas preset ever fires | same |
| frozen mass co-driver, as shipped | Jovian and Neptunian never reach regime 2 at any radius | pins the behaviour of the shipped code. **Explicitly NOT evidence** for "freezing the mass changes nothing" — that is a different proposition, tested below |
| frozen vs coherent mass (added in the lens round) | per-preset disagreement bands to 3 decimals, all strictly below 6 R⊕ | pins the *corrected* §4.3 claim by measurement: the frozen mass **does** change the verdict, and below the radius term rather than above it |
| AC-CRATERBOOT | zero flips over 18 presets × 501 radii spanning the **reachable** `[0.27, 16]`; gravity span 53.3× to 1e-9 (so the sweep is not over a dead input); `R_flip_max < 0.27` with ≥ 2× headroom (`≈ 2.03×`) and `≈ 0.133016`; the real predicate under an extremal admissible condition **does** flip, at exactly that bound | the null result is only meaningful if the channel is live and the detector fires through the real function — both are asserted, not assumed. Domain corrected in the lens round from the slider floor 0.3 to the true reachable floor 0.27 (the Moon/Mercury lab-unlock band) |

### End-to-end proof of the suite (not just its in-test controls)

Beyond the in-test planted defects, one site was reverted **in the real source file**, the suites
were run, and the file was restored:

```
sha256 before : e801bd84d5d94d46f265cab480ab8df70b8dc2bfc0e3cbf3003766090d0c83a5
PLANTED       : state.bandCount re-frozen to the frozen preset constant
result        : Test Files 2 failed (2) | Tests 12 failed | 56 passed (68)
RESTORED
sha256 after  : e801bd84d5d94d46f265cab480ab8df70b8dc2bfc0e3cbf3003766090d0c83a5   (byte-identical)
result        : Test Files 2 passed (2) | Tests 68 passed (68)
```

A single re-frozen site trips 12 checks across both files. The fence, the AC-0 pins and the
behavioural response checks all fire.

**Two more in-file plants, added in the lens round** — both chosen so that *every pre-lens check was
blind to them*, which is the point:

```
sha256 before : 7a7924e21cc787ac3394ef871c2709d5f12ca32a222f649cafbd068819065fe8

PLANT A       : the giant-dynamo cutoff 3.5 -> 3.2
                (canonical verdicts identical for all 18 presets; the "flips exactly once at the
                 source cutoff" test reads the threshold OUT of source, so it passes too)
result        : Tests 4 failed | 80 passed (84)
                caught by  AT THE RADIUS THE LAB ACTUALLY DRAWS > SEED SWEEP  (+ 3 AC-0 source pins)
RESTORED      : sha256 identical

PLANT B       : the lab's boot seed  radiusSeed: 1 -> 2
                (a pure boot-APPEARANCE change; no expression, threshold or law is touched)
result (first attempt, with BOOT_SEED typed as a literal in the test) : 84 passed (84)  <- MISSED
                -> this was a defect in the NEW instrument, found by planting rather than by review.
                   BOOT_SEED is now EXTRACTED from world-engine-lab.html.
result (after the fix) : Tests 4 failed | 81 passed (85)
                caught by  the boot-seed pin, the BOOT DELTA TABLE, the AURORA pin, the E5 BOOT DELTA
RESTORED      : sha256 identical

sha256 after  : 7a7924e21cc787ac3394ef871c2709d5f12ca32a222f649cafbd068819065fe8   (byte-identical)
final result  : Test Files 2 passed (2) | Tests 85 passed (85)
```

---

## 7. Gate output (verbatim)

**Gate 1 — the two new test files**

```
$ npx vitest run tests/radius-live-feed-fence.test.js tests/radius-live-feed.test.js
 RUN  v4.1.0 /home/ax/projects/well-dipper

 Test Files  2 passed (2)
      Tests  85 passed (85)
   Start at  04:11:50
   Duration  458ms (transform 100ms, setup 0ms, import 141ms, tests 311ms, environment 0ms)
```

(68 → 85: four tautological tests deleted, twenty-one real ones added — see §Lens round.)

**Gate 2 — golden byte identity (NO re-capture)**

```
$ npm run verify-golden

> well-dipper@0.0.0 verify-golden
> node tests/golden-trajectories/run-golden.mjs

[golden] PASS — canonical-scenario-v1 matches golden 40c18aad
  samples: 1200 (golden: 1200)
  verified in 4.4 ms
```

Hash **40c18aad**, unchanged. `npm run rebless-golden` was **not** run. Golden fixtures on disk are
unmodified:

```
$ git status --short -- 'tests/golden*' 'tests/fixtures'
(no output — no golden fixture modified)
```

The V2-0 byte-identity suites (the 83-entry carrier check) also pass:

```
$ npx vitest run tests/v2-0-byte-identity.test.js tests/v2-0-slice-a-byte-safety.test.js
 Test Files  2 passed (2)
      Tests  107 passed (107)
```

**Gate 3 — full suite, at exactly the known baseline**

```
$ npx vitest run
 Test Files  17 failed | 151 passed (168)
      Tests  4 failed | 2533 passed (2537)

Failed Tests 4:
 FAIL  src/generation/__tests__/GalacticFeatures.test.js > Galactic Feature Layer > feature types match their galactic context
 FAIL  src/generation/__tests__/KnownObjects.test.js > KnownObjectProfiles > has all five test profiles
 FAIL  src/generation/__tests__/KnownObjects.test.js > searchKnownObjects > is case-insensitive
 FAIL  src/generation/__tests__/KnownObjects.test.js > searchKnownObjects > partial match works
```

Exactly the baseline: **GalacticFeatures ×1 + KnownObjects ×3 = 4**. The other 15 failed *files* are
the vendor `motion-test-kit` file-level failures, which contribute 0 tests (15 vendor + the 2 files
above = the 17 failed files).

Baseline isolated by re-running with the two new files excluded — same 4 failures, and the test count
drops by exactly the tests this build added, so nothing else moved:

```
$ npx vitest run --exclude 'tests/radius-live-feed*.test.js' --exclude '**/node_modules/**'
 Test Files  17 failed | 149 passed (166)
      Tests  4 failed | 2448 passed (2452)
```

2537 − 85 = 2452 exactly, so the lens round moved nothing outside these two files either.

**Gate 4 — the display-scale fence is untouched**

```
$ npx vitest run tests/vis-scale-fence.test.js
 Test Files  1 passed (1)
      Tests  27 passed (27)
```

**Working tree — nothing committed, NOT-OURS untouched**

```
$ git status --short   (tracked modifications only)
 M world-engine-lab.html
 M src/auto/CameraChoreographer.js     <- NOT-OURS, pre-existing, untouched
 M src/debug/LabMode.js                <- NOT-OURS, pre-existing, untouched
```

New untracked files from this build: `tests/radius-live-feed-fence.test.js`,
`tests/radius-live-feed.test.js`, and this document. No `git add` / `commit` / `push` / `checkout` /
`stash` was run.

---

## 8. What is NOT established

1. **No shader was executed and no pixel was compared.** There is no headless GL in this repo and dev
   servers are forbidden. The `uBandCount` liveness argument is static call-graph closure plus exact
   transcription of the closed-form arithmetic; the final "these pixels differ" step is **inferred**.
   AC-BANDS' live A/B (Jovian, **Jets ON**, fixed seed) is still owed.
2. **AC-BYTE is proven for the golden/headless paths, not asserted for the lab.** The lab is not part
   of `run-golden.mjs` / `canonical-scenario.js`, so the goldens could not have moved. The canonical
   *behavioural* inertness of the rewired expressions is proven directly instead: at `R === R_c` every
   rewired site returns bit-identical values to the pre-rewire form, for all 18 presets.
3. **Radius is NOT canonical at boot for 12 of 18 presets — and the lab's boot appearance therefore
   CHANGES for three of them.** This item used to be a hedge ("may already differ", "may differ").
   It is now measured and pinned; see §Lens round, finding [1], for the exact table. Non-negotiable
   consequence for AC-BYTE: the A/B Max runs must be **against the pre-rewire build**, not against a
   slider drag, or it will not surface the boot-time change at all.
4. **The frozen `massEarth` co-driver in the cloud-regime gate** (§4.3) is a recorded, tested,
   deliberate incoherence, not a fix.
5. **`docs/NOW.md` and `RADIUS-CENSUS.md` are not updated** by this build (§4.6).

---

## 9. Lens round (2026-07-25) — three adversarial lenses, findings folded or refuted

Every finding below was re-verified against actual source and actual command output before anything
was changed. Nothing was folded on the strength of the claim alone. Gate output after the round is in
§7 (all three gates re-run and re-recorded).

**Nothing was refuted this round.** All six must-fixes and all seven lower-severity notes reproduced,
with two arithmetic corrections to the findings' own numbers (noted inline). The round also exposed a
defect in one of the *new* instruments, found by planting rather than by review — recorded below.

### Summary

| # | Finding | Verdict | What landed |
|---|---|---|---|
| 1 | The "bit-inert" framing is a conditional whose antecedent is false at boot | **CONFIRMED — folded** | Boot delta measured, disclosed here and pinned by test |
| 2 | Ice giant loses its aurora entirely at the default boot seed | **CONFIRMED — folded** | Disposition recorded at the site; pinned; escalated to Max's UAT gate |
| 3 | The 3.5 cutoff's stated design purpose is silently voided | **CONFIRMED — folded** | The false comment is rewritten; the collapse is pinned by test |
| 4 | Thresholds silently re-pointed at a distribution that straddles them | **CONFIRMED — folded** | Same fixes as 1–3; drawn-radius test surface added |
| 5 | The four "BYTE-INERT AT CANONICAL" tests are tautological | **CONFIRMED — folded** | All four deleted; replaced with a literal oracle from the pre-rewire build |
| 6 | Code, comment and tests disagree at the dynamo gate | **CONFIRMED — folded** | Comment rewritten, drawn-radius tests added |
| A | BUILD-NOTES' frozen-`massEarth` claim is wrong and untested | **CONFIRMED — folded** | Claim corrected in the lab comment and §4.3; a real test added |
| B | G2 states its margin against the wrong floor | **CONFIRMED — folded** | 2.26× → 2.03×; sweep domain widened to the reachable `[0.27, 16]` |
| C | Neither test file evaluates at a radius the lab boots with | **CONFIRMED — folded** | New `AT THE RADIUS THE LAB ACTUALLY DRAWS` block |
| D | The `bandCount` COHERENCE rationale is refuted by measurement | **CONFIRMED — folded** | Comment rewritten with the measured ratio swing |
| E | The cloud-gate mass note is wrong in the reachable direction | **CONFIRMED — folded** | Same as A |
| F | The AC-NOFROZEN fence knows only two frozen-preset spellings | **CONFIRMED — folded** | Bare `fp` alias added to the deny pattern + a planted defect |
| G | `DENY`'s `/g` `lastIndex` is shared between `.test()` and `matchAll` | **CONFIRMED — folded** | Fresh matcher per scan + an instrument-control test |

---

### [1] / [4] — the "bit-inert" claim's antecedent is false at boot

**CONFIRMED.** `state._lastPreset` is never initialised, so the branch at `world-engine-lab.html:3009`
is taken on the first `applyDrivers()` call and `:3010` draws a radius at boot.

Measured (`drawPresetRadius(p, 1, { labUnlock: true })` — byte-for-byte the lab's own call):
**12 of 18 presets boot at a non-canonical radius.** (The finding's prose said 11; its own table
listed 12, and 12 is correct — Moon/Mercury draws 0.2730 vs canonical 0.38 via the lab-unlock band.)

**Of those, three change a discrete rewired site at the shipped default `radiusSeed: 1`:**

| preset | R_c | R drawn | `state.bandCount` | Rhines `m` | visible e5 bands | dynamo |
|---|---|---|---|---|---|---|
| Gas giant (Jovian) | 11.2 | 6.2156 | **14 → 8** | **13 → 10** | **11 → 8** | true → true |
| Gas giant (Saturnian) | 9.4 | 6.2156 | **11 → 7** | **10 → 8** | **10 → 8** | true → true |
| Ice giant (Neptunian) | 3.9 | 2.5404 | 3 → 3 | **3 → 2** | **3 → 2** | **true → FALSE** |

(E5 numbers at the lab's own defaults: `macroSeed 1`, `radiusSeed 1`, through the real
`bakeClimateE5Attributes` / `resolveParams` with each preset's `E5_PRESET_REGIME`.)

The other fifteen presets show no change at any rewired site at boot.

**Folded:** the boot delta is stated plainly here and in §8.3, and pinned by
`tests/radius-live-feed.test.js → "BOOT DELTA TABLE"` / `"E5 BOOT DELTA"` so it cannot drift.
**Consequence for UAT, stated per the finding's suggested fix (a):** *the lab's default boot
appearance changes on Jovian, Saturnian and Neptunian before Max touches anything.* **Max's A/B must
be against the pre-rewire build (`git show HEAD:world-engine-lab.html`), not against a slider drag** —
a slider A/B cannot surface a boot-time change by construction.

### [2] / [6] — the Ice Giant's aurora is extinguished, not dimmed

**CONFIRMED**, reproduced through the lab's own extracted block against the real `deriveUniforms`:

```
Ice giant (Neptunian)   canonical 3.9   drawn @ seed 1 = 2.5404
  OLD  { giantDynamo: true,  mag: 0.6,  auroraIntensity: 0.6, ringLat: 0.82, ringWidth: 0.102 }
  NEW  { giantDynamo: false, mag: 0.05, auroraIntensity: 0.0, ringLat: 0.71, ringWidth: 0.146 }
```

The drop is discontinuous: this preset's derived `magneticField` is **exactly 0.05** and the guard at
`:3566` is a strict `>`, so losing the 0.6 boost does not reduce the aurora — it zeroes it.
`uAuroraIntensity` is written from `state.auroraIntensity` at `:5879`, so it reaches pixels the moment
the (opt-in, default-off) Aurora checkbox is on.

Flip rate over 2001 radius seeds — **Neptunian 1351/2001 (67.5%)**, Sub-Neptune 650/2001 (32.5%),
Jovian / Saturnian / Hot Jupiter 0/2001. (The finding quoted 1349/652 and 66.8%; the small difference
is the seed range sampled. Same conclusion.)

**Folded, and the decision is recorded rather than made silently:**
- The **law is NOT changed.** R1's scope is the feed, not the physics; re-keying the discriminator on
  composition / `massEarth` / the E5 regime tag is a physics edit, and *"should a 2.54 R⊕ ice giant
  keep its ionic-water dynamo"* is a taste call, not a technical one.
- The site comment at `:3557` now states the change, the mechanism, the flip rates and the disposition.
- Pinned by `tests/radius-live-feed.test.js → "THE AURORA REGRESSION, named and pinned"` (exact
  before/after values) and `"SEED SWEEP"` (exact flip counts).
- **This is an explicit Max gate at UAT.** It must not land as an unexplained F37 regression.

### [3] / [6] — the 3.5 cutoff can no longer perform its stated discrimination

**CONFIRMED.** `PRESET_ARCHETYPE` maps both `'Ice giant (Neptunian)'` and `'Sub-Neptune (hazy)'` to
`'sub-neptune'` (a deliberate shared taxonomy identity, V2-3 AC-TAXONOMY-NEPTUNE), hence the same
`RADIUS_RANGES_EARTH['sub-neptune'] = [2.5, 4.0]`; and `drawPresetRadius`'s PRNG key is
`'draw:radius:' + seed` — **it does not include the preset name**. Measured: identical drawn radius on
**2001/2001** seeds, identical post-rewire dynamo verdict on **2001/2001**. At canonical radius the
cutoff did separate them (Neptunian true, Sub-Neptune false).

**Folded:** the comment at `:3557-3559` claiming the inclusion/exclusion was **rewritten**, not left
standing — a false design-intent comment above a rewired line is how the next agent re-derives a wrong
bound. Pinned by `"THE 3.5 CUTOFF CAN NO LONGER DISCRIMINATE…"`, which also asserts the corrected text
is present in the lab.

### [5] — the four "BYTE-INERT AT CANONICAL" tests were tautological

**CONFIRMED, and worse than claimed.** Replicating the exact construction on deliberately broken
sources:

```
Does the "BYTE-INERT AT CANONICAL" test fail on a broken build?
  PASS  (1) the REAL source — baseline
  PASS  (2) BROKEN: rotation divisor tripled (wrong law)
  PASS  (3) BROKEN: band ladder doubled
  PASS  (4) BROKEN: radius multiplied by ZERO — feed fully dead, hard-coded 5
  PASS  (5) BROKEN: +99 (clamps to 16 everywhere)
```

Case (4) is the exact defect class this workstream exists to prevent.

**Folded per the finding's suggested fix:** all four deleted. Replaced with
`PRE_REWIRE_AT_CANONICAL` — a literal table of `[bandCount, cloudRegime, giantDynamo, E5 radius
driver]` per preset, captured by executing the **pre-rewire** expressions out of
`git show HEAD:world-engine-lab.html` (commit `710f8a2`). A substitution-derived oracle inherits every
defect of the thing it checks; a literal from the prior build does not. Its falsifiability is itself
proven by a planted-defect test that runs all four broken variants above and requires each to be
rejected.

### [A] / [E] — the frozen `massEarth` claim was wrong, and untested

**CONFIRMED.** See §4.3, now corrected in place, and the lab comment at `:3402`. Measured over 4001
log-spaced radii: the frozen mass and the note's own coherent `M_c·(R/R_c)³` disagree on **every** gas
preset, and the entire disagreement band lies **below** the 6 R⊕ radius term — Neptunian
`[0.300, 3.261]`, Sub-Neptune `[2.885, 5.998]`, Jovian `[0.300, 3.534]`, Saturnian `[0.300, 4.433]`,
Hot Jupiter `[0.300, 3.800]`. Both ice-giant-class presets draw from `[2.5, 4.0]`, so it is reachable
by reroll. The cited test tested a different proposition. Co-driver still left frozen (scope), but the
divergence is now pinned by a real test.

### [B] — G2's margin was stated against the wrong floor

**CONFIRMED.** `state.planetRadiusEarth` is not floored at `RADIUS_SLIDER_MIN = 0.3`: the lab's draw
site passes `{ labUnlock: true }` and `LAB_UNLOCKED_RANGES['Moon/Mercury (impact-airless)'] =
[0.27, 0.38]`. Measured: **5422 / 20000 seeds (27.1%)** put that preset below 0.3, i.e. outside the
originally swept domain. True floor 0.27 ⇒ headroom **2.03×**, not 2.26×.

**Folded:** number corrected in the lab comment, the fence allowlist `why`, `evidence/G2-…md` and
§3 here; and the AC-CRATERBOOT sweep was **widened to the reachable `[0.27, 16]`** (18 × 501 radii) —
still zero flips, so the exemption stands on the corrected domain rather than on the narrow one.

### [D] — the `bandCount` COHERENCE rationale is refuted

**CONFIRMED.** `state.bandCount` is linear in R; the Rhines wavenumber is ∝ √R. Rewiring both does
**not** hold their ratio fixed. Measured (Jovian, macroSeed 7, ladder ÷ `m`):

| R | 0.3 | 1 | 2 | 4 | 8 | 11.2 | 16 |
|---|---|---|---|---|---|---|---|
| post-rewire ratio | 1.500 | 0.750 | 0.600 | 0.625 | 0.909 | 1.077 | 1.067 |
| pre-rewire ratio | 1.077 | 1.077 | 1.077 | 1.077 | 1.077 | 1.077 | 1.077 |

A ~2.5× swing where there was a constant. **Folded:** the comment at `:3303` is rewritten to say what
rewiring both actually buys (neither ladder is left dead, and the jets are not pinned to one radius'
geometry while the bands move) and to name ratio-stability as a **law** change, i.e. R2, not R1.

### [F] — the fence knew only two frozen-preset spellings

**CONFIRMED.** `buildBodyDrivers(u, fp)` (`:2798`) and `resetDriverOverrides(u, fp)` (`:2787`) bind the
frozen preset as bare `fp`, and `fp.T_eq` / `fp.age` are already read off it. `buildBodyDrivers` is
where the body-driver condition vector is derived — the same class of site as the two the rewire
fixed. **Folded:** `\bfp\b` added to the deny pattern (it cannot match inside `_fp` — no word boundary
after `_`), plus a seventh planted defect that re-freezes `buildBodyDrivers`' condition vector through
the alias, plus `MUST_MATCH` / `MUST_NOT_MATCH` cases including `gfp.radiusEarth` and `fp.T_eq`.

### [G] — `DENY`'s `lastIndex` was shared between `.test()` and `matchAll`

**CONFIRMED, and demonstrated to cause a real miss.** `matchAll` seeds its internal matcher from the
source regex's `lastIndex`, and the allowlist-staleness test left it at **122**:

```
lastIndex after the staleness test: 122
planted offender at offset 4:
  with lastIndex = 122 (polluted): first hit at 406062  -> MISSED
  with lastIndex = 0   (clean)   : first hit at 4       -> CAUGHT
```

**Folded:** the module-level regex is now **non-global** (safe for `.test()`), and the scanner builds a
**fresh global matcher per call**. Proven by a new instrument-control test that plants an offender at
the top of the file *after* running the polluting sequence — it fails on the old scanner (verified by
running the suite against a reverted copy: 7 failed / 35 passed) and passes on the fixed one.

### A defect the lens round found in its OWN fix

The new drawn-radius suite initially hard-coded `BOOT_SEED = 1`. Planting `radiusSeed: 1 → 2` in the
lab — a pure boot-appearance change — passed **84/84**. The seed is now **extracted from source**, and
the same plant fails 4 tests. Recorded because it is the same failure mode the whole block exists to
close: an instrument that re-types a value instead of measuring it cannot see that value change.

### Still owed (unchanged by this round)

The live browser A/B for AC-BANDS / AC-REGIME / AC-RIVERS, the `docs/NOW.md` correction, and
`RADIUS-CENSUS.md` — all still §4.6. **New:** the boot-appearance disclosure above and the ice-giant
aurora decision are both **Max gates**, and the A/B must be run against the pre-rewire build.

### Reproducing every number in this section

All six probes are headless, pure, deterministic (no RNG seeded from wall-clock, no network, no
server) and import the real modules — they do not re-implement anything:

```
node docs/WORKSTREAMS/world-engine-radius-live-feed-2026-07-25/calibration/lens-boot.mjs
    -> canonical vs drawn radius per preset at radiusSeed 1  (finding [1]/[4])
node .../calibration/lens-aurora.mjs
    -> the aurora block OLD/NEW at boot + dynamo flip rates + the shared-draw collapse  ([2]/[3]/[6])
node .../calibration/lens-claims.mjs
    -> the tautology demonstration, the massEarth divergence bands, the crater floor,
       and the bandCount-vs-Rhines ratio table                                          ([5]/[A]/[B]/[D])
node .../calibration/lens-lastindex.mjs
    -> the regex lastIndex pollution and the missed offender                            ([G])
node .../calibration/lens-prerewire.mjs
    -> regenerates PRE_REWIRE_AT_CANONICAL from `git show HEAD:world-engine-lab.html`      ([5])
node .../calibration/lens-e5boot.mjs
    -> the E5 end-to-end boot delta at the lab's own defaults                            ([1])
```

---

## §10 — DISPOSITION CORRECTION: the giant-dynamo gate reads CANONICAL (working-Claude, post-lens)

The fix round disclosed the aurora regression thoroughly and then **left it in place**, classing
"should a 2.54 R⊕ ice giant keep its ionic-water dynamo" as a taste call for Max. That framing was
wrong, and the site is now corrected.

**It is not a taste call, on two independent grounds.**

1. **Structural — the gate cannot do its job on drawn radius, at any seed.** `PRESET_ARCHETYPE`
   deliberately maps both `'Ice giant (Neptunian)'` and `'Sub-Neptune (hazy)'` to `'sub-neptune'`
   (V2-3 AC-TAXONOMY-NEPTUNE, commented as intentional), and `drawPresetRadius` keys its PRNG on
   `'draw:radius:' + seed` with **no preset name** (`driver-presets.js:271`). So the two presets
   receive bit-identical drawn radii — measured 2001/2001 seeds. A size-keyed discriminator must
   therefore return the same verdict for two *different compositions*, necessarily. The 3.5 cutoff's
   entire recorded purpose is to separate exactly those two. Feeding it the drawn radius did not
   make it more responsive; it reduced its discriminating power to zero.
2. **Frame-derived.** The ratified V2-6 model is "a bigger body of the **same composition**"
   (`body-condition-vector.js`). Composition is the quantity the slider holds fixed, so the drawn
   radius carries no composition information by construction. Keying a *composition classifier* on it
   infers composition from size — a category error independent of the aurora consequence.


**The consequence that made it visible.** The Neptunian's derived `magneticField` is exactly `0.05`
and the intensity guard is a strict `>`, so losing the 0.6 dynamo boost did not dim the aurora — it
**extinguished** it (0.6 → 0.0), on 67.5% of seeds including the shipped default. That breaches
Max's own stated criterion, "nothing that worked before breaks."

**Rule adopted for the workstream:** *a CLASSIFIER reads canonical; a PHYSICS INPUT reads drawn.*
This is the same disposition AC-CRATERBOOT reached on evidence, generalised. Under it:

| Site | Reads | Why |
|---|---|---|
| `:2863` Rhines band radius | drawn | physics input |
| `:2947` storm/vortex drivers | drawn | physics input |
| `:3306` F25 jet stripe ladder | drawn | physics input (geometry) |
| cloud-regime gate | drawn | responds on Sub-Neptune; mass term preserves discrimination |
| giant-dynamo gate | **canonical** | composition classifier — this correction |
| crater-boot enable set | canonical | composition/domain classifier (G2 measured) |

**NOT claimed:** that dynamo strength is radius-independent. A larger ionic-water envelope plausibly
drives a stronger dynamo. But expressing that needs a discriminator reading composition/mass **and**
size — a physics edit, outside R1. **R2 item, recorded not dropped.** If Max wants the dynamo to
answer the slider, that model is the honest route; re-pointing the size proxy is not.

**Verification of the correction itself** (planted-defect discipline applied to my own edit):
re-pointing the gate at `state.planetRadiusEarth` makes the suite **FAIL** (2 tests, incl. the
extraction guard throwing loudly); restoring gives sha256 `e36a0bde…`, byte-identical, **85/85 green**.
Gates after the correction: `verify-golden` PASS `40c18aad` fixtures unmodified; full suite
**4 failed / 2533 passed** (2537 − 85 new = 2452 = exact baseline).

Contract `AC-REGIME` amended with the full audit trail in `contract.json → amendments[]`.
