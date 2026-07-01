# #2 Blackbody Emission v1 — BUILD PLAN (reshaped)

Derived from the model-verify+plan workflow `wf_6a8a85d8-08b` (build-ready) + working-Claude
firsthand verification + Max's two decisions (2026-07-01). Records what we build and why so no
session has to reverse-engineer it. Companion to `intent.md` + `contract.json`.

## The reshape (verified firsthand)

The emission RENDER already exists as **F32 (dayside-hotspot) + F33 (nightside-glow)** (lab-status
partial). Confirmed in code:
- `emissiveBlackbody(tempK)` — GLSL `planet-lod-height.glsl.js:734` + CPU twin `planet-lod-lab-core.js:127`
  ("ONE curve, two consumers"; also feeds shipped F41 magma).
- East-advected hotspot: `uThermalDir` = light dir rotated east about spin by `hotspotOffset`
  (0.26 rad ≈ 15°, calibrated between WASP-43b 7.75° and HD-189733b 30°); per-frame at `planet-lod-lab.html:5677`.
- `uDayTempK = T_eq×1.15`, `uNightTempK` ≈ 1100 K ("Keating universal" floor), gated on `uThermalStrength` (line 5684).
- **The "hot giant renders cold" bug** = `daysideThermalEnabled`/`nightsideThermalEnabled` default **false**
  (2096-97); the Hot-Jupiter derivation (3467-75) sets `thermalStrength=1`/`dayTempK`/`nightTempK` but
  never flips the enables → gate zeroes the glow. Two unset flags.

## What #2 builds

### Slice 1 — data-register module (headless) — AC1/AC2/AC3
`src/worldengine/base/emission-e.js` (mirrors `climate-e5.js` determinism discipline; `alea` off
`macroSeed`, `emissionE:` namespace, no `Math.random`/`Date.now`):
- `EMISSION_PHYS = { DAY_LIFT: 1.15, NIGHT_FLOOR_K: 1100, HOTSPOT_OFFSET_RAD: 0.26, LUM_ANCHOR_K: 1800 }`.
- `visibleLuminance(tempK)` — photopic-weighted visible-band luminance (Planck × CIE V(λ)),
  **re-anchored to `LUM_ANCHOR_K`=1800 K = 1** (critique fix: NOT 6500 K, which renders a 1500–2500 K
  hot-Jupiter black). ~0 (<1e-3) below ~800 K; strictly monotonic. This is the AC1 *physical reference*.
- `blackbodyEmission(tempK)` → `{ rgb, lum, rgbTonemapped }`; `rgb` = the one-curve `emissiveBlackbody`
  chroma, `lum` = visibleLuminance, `rgbTonemapped` = per-channel `min(rgb*lum, 1)` (finite/in-gamut —
  there is NO tonemapper in this lab; hard clip only).
- `writeEmissionESphere(carrier, drivers, {regime, macroSeed, tempEq, locked, eqSign, hotspotOffset,
  redistribution, obliquityDeg})` → `{ emitT, emitLum, substellarDir, hotspotDir, dayPeakK, nightFloorK,
  locked, params }`. NON-locked: `T = tempEq*DAY_LIFT*wardInsolation(sinLat, obliquity)` (latitude-only).
  LOCKED: `T = mix(NIGHT_FLOOR_K, dayPeakK, pow(max(dot(node, hotspotDir),0), redistribution))`, bounded
  `[NIGHT_FLOOR_K, dayPeakK]`; `hotspotDir` = substellarDir rotated east by `hotspotOffset*sign(eqSign)`.
  **Never** writes `carrier.height` or any #3a field — returns its own Float32Arrays.
- `bakeEmissionEAttributes(...)` — optional per-vertex substrate parity with `bakeClimateE5Attributes`
  (for #5/#6; NOT wired into the #2 render).

`tests/worldengine-base-emission-e.test.js` (mirror `worldengine-base-climate-e5.test.js`):
AC1 (locus monotonic, cold=~0, in-gamut) · AC2 (locked/non-locked geometry, bounded, re-derivation
within 1e-3) · AC3 (no-RNG grep, `emissionE:` namespace, twice-run byte-identity, carrier.height + #3a
fields untouched, climate-e5 golden bandField hash still **-1329854088**) · **CPU↔GLSL parity** (regex-
extract the GLSL `emissiveBlackbody` stops and assert equal to the CPU stops — the missing test that
pins the one-curve contract so a future stop-edit can't silently diverge across F32/F33/F41).

**One-curve discipline:** follow whatever import discipline `climate-e5.js` uses. If `base/` modules stay
self-contained (no repo-root import), DUPLICATE the stops in `emission-e.js` and let the parity test pin
them equal; else import the CPU `emissiveBlackbody`. Either way the parity test is mandatory.

### Slice 2 — lab wiring (in-browser) — AC4/AC5/AC6/AC7-setup
Four edits to `planet-lod-lab.html` (re-read exact anchors before editing — line numbers approximate):
1. State (~2090-97): add `thermalTempEq: 280.0,` (live sweep source, decoupled from the `.listen()`
   `dayTempK` display) + `emissionEnabled: true,` (master register gate).
2. Hot-Jupiter derivation (~3467-75): add `state.daysideThermalEnabled = _hotJup;
   state.nightsideThermalEnabled = _hotJup;` (**the renders-cold fix**) + `state.thermalTempEq = _fp.T_eq ?? 288;`.
3. GUI (~4427-35): `fThermal.add(state,'thermalTempEq',300,2500,10).name('T_eq sweep (K)');` +
   `fThermal.add(state,'emissionEnabled').name('emission register');`.
4. Per-frame writer (~5677-84): `state.dayTempK = state.thermalTempEq * 1.15;` (sweep drives glow live);
   master gate `uThermalStrength.value = (state.emissionEnabled && (daysideThermalEnabled ||
   nightsideThermalEnabled)) ? state.thermalStrength : 0.0;`; east-sign `const _eastSign =
   Math.sign(state.eqSign||1)||1;` applied to `hotspotOffset` in the `applyAxisAngle` (retrograde flip;
   hot-Jupiter is prograde → unchanged). If `state.eqSign` is absent, default +1 and flag it.

### Slice 3 — SKIPPED (Max: incandescent white core). No `planet-lod-height.glsl.js:1083` cap. AC7 re-worded.

### Slice 4 — live integration (working-Claude, chrome-devtools): AC4/AC5/AC6/AC7. Needs the lab served
from THIS worktree (`well-dipper-we-atmo`). → `VERIFIED_PENDING_MAX <sha>`.

### Slice 5 — AC8 holistic UAT (Max only; never auto-passed).

## Critique fixes folded in (all applied above)
- Keep emission PER-FRAGMENT (not a per-vertex LUT bake — would freeze the hotspot + break AC5/AC6).
- visibleLuminance anchored ~1800 K, not 6500 K (else hot-Jupiter renders black).
- NO global ACES tonemapper (lab has none; hard `min(·,1)` clip — a global tonemapper would shift the
  reflectance path and break AC7). Cap the hot end locally if ever needed.
- ONE curve; do NOT add a Tanner-Helland fallback or re-author to linear-sRGB (stops are hand-authored
  display-referred, tuned against shipped F41/F32/F33).
- Add the CPU↔GLSL parity test (the real regression-safety gap).

## Decisions (Max 2026-07-01)
- **Scope:** full reshaped #2 (wiring + register + parity test).
- **Hotspot core:** incandescent white core accepted; bands read in the penumbra (AC7 re-worded; no cap).
- **Brightness authority:** keep the shipped `(tempK/1800)^4` quartic for the RENDER; visibleLuminance is
  the data-layer AC1 reference only (unifying would force re-UAT of shipped F41 magma).
