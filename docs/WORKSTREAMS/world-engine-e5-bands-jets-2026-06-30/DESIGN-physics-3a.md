# #3a — Physics design + build intent (writer layer)

Companion to `intent.md` + `contract.json`. Records WHAT `climate-e5.js` computes and WHY, so neither
Max nor a future session has to reverse-engineer the code. The writer was extended from the faithful
unsigned `u(lat)` lift into a **signed, driver-organized, per-seed** field + two depth channels + the
Ward insolation substrate.

## What the writer produces (per carrier node, Float32Array)
- `bandField` — signed zonal wind `u(lat)` (the master field; also the render **advection** channel:
  sign = flow direction, magnitude = scroll speed for "churning belts, not static").
- `bandNorm` — `[0,1]` render value (haze-muted, envMax-normalized so the hot-poles feature isn't clipped).
- `turbulence` — shear-gated filament texture `|du/dφ|·filament` (∈ `[0, turbBound]`, exactly 0 at zero shear).
- `mushball` — NH₃ compositional banding, its own latitude-banded channel (not folded into `u`).
- `W` — Ward annual-mean insolation `W(lat,ε)` (substrate reserved for #2/#3b/#5..#9 + AC7/AC12 render).
- `shearMag` — `|du/dφ|` (the turbulence gate; also a render gate).
- Diagnostics: `bandCount` (zero-crossings of u), `jetCount` (extrema of u), `peakU`, `eqSign`, `sEq`,
  `wardS2`, `envMax`, `phaseJet`, `phaseMush`, `turbBound`, `params` (full closed-form set for AC3).

## The five laws (coefficients in `PHYS`; drivers in `DRIVER_BUNDLES`)
1. **Rhines band count** `N = RHINES_K·√(a·Ω/U)`, floored at 2. `RHINES_K=15.2` → Jovian ≈12, Neptunian ≈3.
2. **Equatorial jet sign** `s_eq = tanh(6·(D/a − 0.40))` — deep shell → prograde, thin → retrograde; continuous/driver-flippable.
3. **Amplitude law** `U = √(F_int/dissipation)·(1+κ(1−D/a))` — insolation deliberately ABSENT (the wind paradox); Neptunian |U| highest.
4. **Ward insolation** `s2(ε)=(5/16)(3sin²ε−2)`, `W=1+s2·P2(sinφ)`; `s2` flips sign at ε=54.74° → hot poles (Uranus tell).
5. **Depth layers** turbulence = `|du/dφ|·filament` (filament∈[0.4,1.0] for corr robustness); mushball = own NH₃ sinusoid.

**Compute order is load-bearing:** LAW3 (`U_peak`) → LAW1 (`m`). One-directional; `m` never feeds back into `U_peak`.

## The signed profile
`u(φ) = U_peak·[ s_eq·A_eq·eqGauss(φ) + A_mid·sin(m·φ+phaseJet)·(1−eqGauss)·envWard(φ) ]`.
`eqGauss` owns the tropics so `sign(u(0)) === sign(s_eq)` robustly (the mid-jet term is annihilated at
the equator by `1−eqGauss = 0`). Pure function of latitude + resolved params → passes the AC3 zonality bar.

## Deliberate NON-goals (this increment)
Emission register (aurora/lightning/glow/hot-Jupiter render), vortices / great-spots (#3b), terrestrial
precip→E9, missing archetypes (Mars/lava/Pluto-Triton/brown-dwarf). No relief write, ever (AC9).

## Verification provenance
Physics adversarially verified BEFORE implementation by a 7-agent workflow (5 per-law refuters +
completeness critic + synthesizer): **all five laws CONFIRMED**, verdict **GO-WITH-FIXES**. Seven
corrections applied: (1) saturnian sign annotation +0.9999→+0.995; (2) bandNorm normalization
`(A_eq+A_mid)→(A_eq+A_mid·envMax)` [prevents clipping the hot-poles feature]; (3) emit `W` + diagnostics
struct + per-seed phases; (4) distinct `bandCount`/`jetCount`; (5) documented turbulence `[0, turbBound]`
(node-derived, tight); (6) LAW3→LAW1 compute-order note; (7) `u`-as-advection-channel seam. Nine
calibration fragilities noted (chiefly: AC4 round()-plateau needs wide rotation spacing → tests sweep
Ω∈{0.4,1.0,1.8}; AC8 corr margin → filament∈[0.4,1.0]; Neptune count k=15.2→3).

Unit layer: **AC1–AC9 green** (`tests/worldengine-base-climate-e5.test.js`, 16/16; base group 171/171).
Golden `bandField` hash (gas-giant, seed 1) = `-1329854088`. AC10–AC12 (render/live) + AC13 (Max UAT) pending.
