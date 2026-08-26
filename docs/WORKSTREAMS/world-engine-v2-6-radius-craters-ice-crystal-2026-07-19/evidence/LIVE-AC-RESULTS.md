# V2-6 — Live Integration AC Results

Workstream `world-engine-v2-6-radius-craters-ice-crystal-2026-07-19`.
Objective integration probes on the L1 lab, `:5175` (`/well-dipper/world-engine-lab.html`),
branch `feature/world-engine-production-L1` @ `7cf32fe`. Driven 2026-07-20 by working-Claude
(fresh CDP page on Max's Chrome, one page, opened + closed by the probe; his own tabs untouched).

**These are OBJECTIVE integration probes only. UAT (AC-UAT) is Max's gate alone — nothing here
renders holistic acceptance.** Lab display N = **40,000-node** carrier mesh (the documented
headless envelope was computed on a ~10k mesh; mesh-dependent counts differ as noted, mesh-
independent metrics match to 3+ sig figs).

Console across ALL drive sessions: **zero new errors / warnings / pageerrors / request-failures**
(only `[vite] connecting/connected` debug lines). `heightSource === "carrier"` on every crater
render (baked relief samples the crater carrier, precondition met via `reliefBakeStrength(1)` + route).

---

## AC-LAB-LEGIBLE — PASS

**Method.** Boot `Moon/Mercury (impact-airless)` (NAMED_BODY, canonical R = 0.38 R⊕, g = 0.277 — a
LOW-gravity airless body). `reliefBakeStrength(1)` + `applyDrivers()` (route) so the crater channel
composites into the baked height. Screenshots at judging distance (full disk, `pixelScale=1` to clear
the default ÷3 dither, planet rotated so cratered terrain crosses the terminator for raking-light
shadows). Crater population read live off `riverOverlay.reliefCarrier.craterField` and reproduced via
`craterSchedule(cond)` (dynamic-imported in-page).

**Measured (live), vs the BUILD-NOTES documented envelope:**

| metric | live (40k mesh) | documented (~10k mesh) | note |
|---|---|---|---|
| coverage (closed-form drawn) | **42.86 %** | 42.9 % | match; inside MATURE envelope [33.7 %, 46.1 %] |
| nAnalytic | 2,137,278 | 2.14e6 | match |
| nStamp | **147** | 147 | exact (mesh-independent) |
| nRetained (clean-floor) | **82** | 71 | higher on the finer 40k mesh — more distinct floors resolved, expected direction, not a regression |
| craterField nonzero nodes | 33,435 / 40,000 (83.59 %) | — | field densely populated |

**Verdict.** Craters are scheduled AND stamped at the Moon's low gravity (0.277) at boot — the direct
fix for "craters don't read until gravity is turned up." Coverage/nStamp reproduce the headless envelope
exactly; coverage sits squarely in the MATURE band. Visually (`ac-legible-disk-y2.png`,
`-y2-near.png`, `-y1.png`) the disk reads as a densely, discretely cratered airless surface — rounded
bowls with bright rims, most legible along the terminator. **Honest limitation:** the surface is a
saturation-equilibrium palimpsest (43 % coverage → overlapping soft-shouldered craters, physically
correct for an airless body, cf. lunar highlands) rather than sparse textbook ring craters; and crispest
legibility needs `pixelScale=1` (the default ÷3 dither softens the read — a lab display setting, not a
crater-wiring issue). Evidence: `ac-legible-disk-y{0..4}.png`, `ac-legible-disk-y2-near.png`,
`ac-legible-moon-{global,zoom,zoom2}.png`; numbers in `metrics.json` / `legible-crisp-metrics.json`.

---

## AC-RADIUS-AB — PASS

**Method (paired same-worldSeed, REQUIRED protocol).** `Frozen (airless)` (archetype impact surface),
`macroSeed = 4242` FIXED across both renders (the crater RNG seed held constant → genuinely paired);
only drawn R changed via the `planetRadiusEarth` override (the sanctioned A/B toggle at fixed seed,
BUILD-PLAN §1H/L26). Render A: R = 0.30. Render B: R = 2.00. Schedule metrics read in-page for each;
screenshots as corroboration.

**Measured:**

| metric | R = 0.30 | R = 2.00 | ratio (B/A) | law | direction |
|---|---|---|---|---|---|
| **count** nAnalytic | 1,332,099 | 59,204,383 | **44.44×** | R² ratio = (2.0/0.3)² = 44.44 → **EXACT ∝ R²** | count **increases** with R ✓ |
| **fixed-km angular size** radPerKm (= angular Ø of a 1 km crater) | 5.232e-4 rad | 7.848e-5 rad | **0.150× (i.e. 1/6.667)** | R ratio = 6.667 → **EXACT ∝ 1/R** | a fixed physical crater is **smaller** on the large body ✓ |
| drawn low-edge angular (D_LO·radPerKm, 1 km anchor) | 5.232e-4 rad | 7.848e-5 rad | 1/6.667 | ∝ 1/R | ✓ |
| coverage (closed-form) | 48.68 % | 33.23 % | — | both in [10 %, 80 %] (log-drift band) | ✓ |

**Reported transparently (expected physics, NOT a failure):** the *truncated stamped-band* median
angular size is R-invariant — 0.07849 rad (R 0.30) vs 0.07847 rad (R 2.00). Both stamp-band edges scale
∝ R (D_FLOOR and D_HI), so the stamped angular ensemble is scale-free/self-similar. This is exactly the
BUILD-PLAN honesty note (Lens L27 / §9 risk 2): at matched GLOBAL view the two bodies look statistically
alike **by real crater-equilibrium physics**, and a global-disk comparison must not be scored as a wiring
failure. The genuine 1/R + R² signal lives in the drawn-population metrics above (count ∝ R², fixed-km
feature ∝ 1/R) — both measured EXACT.

**Verdict.** The 1/R size law and R² count law are both wired and measured exact under the required
paired-seed protocol. Visual corroboration (`ac-radius-ab-{small,large}-disk-clean.png`, same seed 4242,
same distance 2.6, `pixelScale=1`): the small body reads deeper, crisper craters; the large body reads
smoother/finer, proportionally smaller craters — qualitatively "proportionally smaller and more numerous
on the large body," with the global disks broadly self-similar as predicted. Numbers in `metrics.json`
(`AC_RADIUS_AB_small` / `_large`).

---

## AC-REROLL — PASS

**Method.** Drove the real radius-draw path via exposed `_lab.rerollRadius()` (which is
`radiusSeed = random → _radiusDirty → drawPresetRadius(preset, radiusSeed) → applyDrivers` — the
identical radius machinery `newPlanet()` invokes) and cross-checked the pure draw law via
`_lab.drawPresetRadius(name, seed)` across 8 seeds incl. extremes.

**Drawn radius VARIES across successive rolls (archetype presets), 6 rolls each — all 6 distinct:**

| preset | drawn-R sequence (6 rerolls) | distinct | range |
|---|---|---|---|
| Frozen (airless) | 0.573, 0.746, 0.819, 1.171, 0.927, 0.622 | 6/6 | [0.573, 1.171] |
| Rocky (Earthlike) | 0.913, 0.988, 1.020, 1.199, 1.013, 0.941 | 6/6 | [0.913, 1.199] |
| Crystal (faceted) | 0.625, 0.703, 0.474, 0.334, 0.765, 0.659 | 6/6 | [0.334, 0.765] |

**NAMED_BODY presets PIN to canonical (rerollRadius pins the same value every roll) — 4 verified (≥2 req):**

| named body | canonical | 4 rerolls | pinned? |
|---|---|---|---|
| Moon/Mercury (impact-airless) | 0.38 | 0.38, 0.38, 0.38, 0.38 | ✓ |
| Mars (arid rocky) | 0.53 | 0.53, 0.53, 0.53, 0.53 | ✓ |
| Magma (K2-141b) | 1.5 | 1.5, 1.5, 1.5, 1.5 | ✓ |
| Hot Jupiter (locked giant) | 13 | 13, 13, 13, 13 | ✓ |

Pure-draw cross-check (`drawPresetRadius` over seeds [1,2,7,42,100,999,123456,4294967290]): archetypes →
8 distinct radii; every named body → 1 distinct value (canonical) across all 8 seeds including extremes.

**Verdict.** Successive rolls vary the drawn radius on archetype presets; NAMED_BODY presets lock to
canonical regardless of seed. **Honest limitation:** I could not click the physical `🌍 new planet
(re-roll all)` dat.GUI button — the lab renders its GUI with non-`dat.GUI` markup (lil-gui) so the
text-matched button lookup found no `li.cr.function` node, and a bare `import('alea')` from the isolated
CDP context does not resolve (dev-server rewrites bare specifiers only for statically-served modules).
The radius-reroll OBSERVABLE is nonetheless fully exercised through the real
`rerollRadius → drawPresetRadius → applyDrivers` state path; the worldSeed→sub-seed alea derivation that
`newPlanet()` adds on top is byte-covered by the unit suite. Numbers in `reroll.json`.

---

## Summary

| AC | verdict | one-line |
|---|---|---|
| AC-LAB-LEGIBLE | **PASS** | Moon boots discrete cratered surface at g=0.277; coverage 42.86 % / nStamp 147 reproduce the headless envelope exactly; nRetained 82 (finer 40k mesh) |
| AC-RADIUS-AB | **PASS** | paired seed: count ∝ R² EXACT (44.44× for 6.667× R); fixed-km crater angular size ∝ 1/R EXACT; stamped-band R-invariance is expected self-similarity per L27 |
| AC-REROLL | **PASS** | archetype rolls give 6/6 distinct radii; 4 named bodies pin canonical across all rolls + all 8 cross-check seeds |

New console errors: **none.** BLOCKED: none.
