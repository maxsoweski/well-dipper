# Increment 2 SLICE B — driver→tune calibration spec

**Role:** the analog of shell-relief's `SLICE-B-stress-math.md` — pins the four transfer functions
(form, sign, scaling rationale, clamps) and the Earth anchor BEFORE wiring, so the calibration isn't
invented inline and AC3's per-driver direction has a documented anchor. Implements `driversToTune(D)`
(plates.js) + the lab's per-preset driver derivation. Grounded in the live code, not assumed.

## The Earth anchor (the #1 must-fix, corrected)

`driversToTune` must return DEFAULTS (→ null override → byte-identical, AC2) at the **real Earth
point**, i.e. the drivers the lab *actually derives* for the `Rocky (Earthlike)` preset — NOT a
0-vector and NOT the panel's worked-example normalization.

⚠ **Correction to the carried caveat.** The ROADMAP/cross-cutting note warned "Earth maps to
tidalHeatNorm ≈ 0.19." That was the `wryb3pfpb` panel's *example* normalization, which the ROADMAP
itself flagged as un-calibrated. The **lab's actual** `tidalHeat` for Rocky (computed from the live
formula `planet-lod-lab-core.js:526-528`, ecc 0.017 / 1 AU / 1 R⊕) is **≈ 0.0017** Io-normalized —
effectively ~0. So Earth sits at the *bottom* of the tidal-heating axis, as expected. The anchor is
the derived value, whatever it is; the implementation reads it, it is not hand-tuned.

`D_EARTH` (frozen in plates.js) = the Rocky preset's **derived** drivers:

| driver | source (live) | Earth value |
|---|---|---|
| `massGravity` | `massEarth / radiusEarth²` (lab-core:514) | **0.9** (Rocky massEarth 0.9, R 1.0 — note: NOT 1.0 g) |
| `volatileFraction` | `composition.volatileFraction` (preset) | **0.15** |
| `tidalHeating` | Io-normalized star-tidal `tidalHeat` (lab-core:526-528) | **≈ 0.0017** |
| `age` | NEW preset field (Gyr) — surfaced this increment | **4.5** |

Each transfer function is anchored so `f(D_EARTH.value) = 1.0` (multiplicative) or `= 0` (additive)
**exactly** → at `D_EARTH` every override field equals its DEFAULT → `driversToTune` returns `null`.

## The driver → plate-parameter map

| driver | plate param(s) | direction | why |
|---|---|---|---|
| `massGravity` | `UPLIFT_GAIN`, `RIFT_GAIN` | g↑ → relief↓ | max topographic relief ∝ 1/g (isostasy + crustal yield strength); **matches the house convention** `reliefGravityFactor = clamp(g^(-0.5), 0.4, 2.5)` (lab-core:984) |
| `volatileFraction` | `CONTINENTAL_FRACTION` (primary) | vf↑ → continental↓ | a larger water/volatile budget drowns more continental crust → less exposed/continental plate fraction |
| `tidalHeating` | `PLATE_COUNT_MIN` | th↑ → plates↑ | higher internal/tidal heat → more vigorous convection, thinner lithosphere → more, smaller plates (Io = high-heat exemplar) |
| `age` | `CONTINENTAL_FRACTION` (secondary) | age↑ → continental↑ | continental crust **volume grows** over geologic time; deliberately a *small* nudge, NOT erosion (erosion is E9 / a later increment — do not trespass) |

**No double-count check (verified):** the carrier (plate) bake displacement is `baked.x *
uReliefBakeStrength` (planet-lod-lab.html:350) — there is **NO gravity factor on the carrier path**.
`reliefGravityFactor` only scales the legacy *synth* uniforms (uMountainAmp…), which are default-OFF.
So gravity→`UPLIFT_GAIN` in generation is the *only* gravity→relief coupling for the carrier — clean.

## The four transfer functions (first cut — constants tunable for UAT)

Let `g0=0.9, vf0=0.15, th0=clamp01(D_EARTH.tidalHeating), age0=4.5`. `D = DEFAULTS`.

1. **gravity** — `gFactor = clamp((g/g0)^(-0.5), 0.4, 2.5)`;
   `UPLIFT_GAIN = D.UPLIFT_GAIN * gFactor`, `RIFT_GAIN = D.RIFT_GAIN * gFactor`.
   (g=g0 → 1.0 → default; g=0.38 → ~1.5×; g=2.5 → ~0.6×.) Same shape/clamp as `reliefGravityFactor`.
2. **volatiles** — `CONTINENTAL_FRACTION = clamp(0.5 + 1.0*(vf0 - vf) + ageTerm, 0.1, 0.9)`.
   (vf=0.15 → 0.5; vf=0.35 ocean → 0.30; vf=0.02 dry → 0.63.)
3. **age** (the `ageTerm` above) — `ageTerm = 0.03 * (age - age0)`.
   (age=4.5 → 0; age=1 young → −0.105; age=10 → +0.165.) Secondary to volatiles by design.
4. **tidal heating** — `thp = clamp01(tidalHeat)`; `countFactor = 1 + 0.8*(thp - th0)`;
   `PLATE_COUNT_MIN = clamp(round(7 * countFactor), 5, 14)`; `PLATE_COUNT_SPAN` unchanged (keeps AC6 variety).
   (thp≈0.0017 Earth → 7; thp=1 Io-grade → ~13.)

At `D_EARTH`: gFactor=1, CONTINENTAL_FRACTION=0.5, PLATE_COUNT_MIN=7 — all = DEFAULTS → `driversToTune` returns `null` (AC2). ✓

## D16 age surfacing (AC4)

Add an `age` (Gyr) field to the terrestrial/ocean presets in `DRIVER_PRESETS` (Rocky 4.5, Ocean 3.0,
Mars 4.5). The lab builds `bodyDrivers = { massGravity: surfaceGravity, volatileFraction, tidalHeating:
tidalHeat, age: preset.age ?? 4.5 }` from the **already-derived** uniforms (surfaceGravity + tidalHeat
are in the `deriveUniforms` output, lab-core:930-931) and passes it to `route({ bodyDrivers })`. A
preset that omits `age` defaults to `age0` → `ageTerm = 0` → no age response → stays AC2-byte-identical
(AC4's age-less guard).

## Wiring + tests

- **plates.js:** replace the `driversToTune` stub with the above; export. Pure, no RNG.
- **planet-lod-lab.html:** add `age` to the 3 plate-path presets; build `bodyDrivers` + pass to `route()`;
  surface the applied tune in `plateProbe()` for AC6.
- **tests:** AC3 (per-driver monotone + correct-sign, sweeping each with others at D_EARTH; replaces the
  SLICE-A transient invariant), AC4 (age surfaced + consumed + age-less guard). AC1/AC2/AC5 already green
  from SLICE A and must stay green (Earth still byte-identical).
- **AC6 live:** drive :5173/:9223, sweep each driver on Rocky, A/B two driver draws at fixed seed.

## Open knobs for Max's AC7 UAT (not blockers)

The four strength constants (`kV=1.0`, `kA=0.03`, `kT=0.8`, the `g^(-0.5)` exponent + [0.4,2.5] clamp)
set *how strongly* worlds diverge. First cut chosen for "visible but physically sane"; Max tunes at UAT.
