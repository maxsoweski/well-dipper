# atmo-expression — BUILD-NOTES (AC-0 spine-conformance artifact)

> The filed record the AC-0 audit reads: every new field's deriver + DAG consumer + taxonomy
> registration, plus the manual audit notes automation can't see. Filed 2026-07-17 at the
> verify pass (the plan's §5 inventory is the source; §10 MINOR-4 committed to this file).

## New fields — deriver → consumer (all ADDITIVE: uniforms only, zero new baked attributes)

| Field | Deriver (AC-0 backing) | DAG consumer |
|---|---|---|
| `uBandM` | `P.m` — `rhinesWavenumber` over the D-slot triple via `deriveGiantDrivers`→`resolveParams` (D-slot-backed) | `bandProxy` in `zonalBandCol` |
| `uBandPhaseJet` | `P.phaseJet` — `resolveParams` on `climateE5:params` (named derivation) | `bandProxy` |
| `uBandSEq` | `P.sEq` — `equatorialJetSign(shellDepthFrac)` (D-slot-backed) | `bandProxy` |
| `uBandAMid` | `P.aMid` — `resolveParams` (named derivation) | `bandProxy` |
| `uBandS2` | `P.s2` — `wardS2(obliquity)` (named derivation) | `bandProxy` (envelope) |
| `uBandDeflectScale` | `0.5·P.contrast/(P.aEq+P.aMid·P.envMax)` — export-site derivation, parity-tested | `bandProxy` |
| `uAtmoInk` | boldness dial, default 1.0 — **declared-frozen-with-named-deriver** (future deriver: convective vigor → ink) | `dWake` + `dAdvect` |
| `uInkStretch` | anisotropy dial, default 3.5 — declared-frozen-with-named-deriver (future: jet-speed → stretch) | `dAdvect` |
| `uBandRough` | `drawBandRoughness(regime, macroSeed)` on the NEW disjoint append-only `bandFlow:rough` stream (named derivation) | slice-J edge term in `zonalBandCol` |

GLSL consts (no uniform): `AEQ/PHI_EQ/WARD_GAIN/ENV_BASE` from `PHYS`; `INK_FREQ/FOLD_K/FOLD_FREQ/
ROUGH_FREQ/ROUGH_AMP/ROUGH_BELT/ROUGH_EDGE/WAKE_*` — calibration-pinned, GLSL≡mirror parity-tested
(`tests/worldengine-base-band-flow.test.js` literal-parity legs). `INK_AMP`/`ROUGH_AMP` frozen at the
2026-07-17 Phase-B read-gate (×2 / ×1.5); `WAKE_*` frozen as-built at the slice-I live gate
(`calibration-candidates.md` ruling sections).

## Taxonomy registration (the manual audit note — the drift guard is blind to non-`*Enabled` keys)

The three new GUI dials (`bandRough` roughness, `atmoInk` boldness, `inkStretch` anisotropy) are
**value-slider driver overrides** in the bands folder: they ride the already-registered
`PROV_BANDS` band deck / `PROV_GREATSPOT` storm weight provinces, add **NO `*Enabled` key, NO
FEATURES row, NO new `PROV_*` province** (`planet-archetypes.js` diff is empty; drift guard
21/21). `bandRough` carries the touched-flag override so a manual value survives `applyDrivers`.

## Golden-safety record

- `GOLDEN_BANDFIELD_HASH` — proxy uniforms are READ from `bake.params`, consumed only in the new
  `dBand` term; `bakeClimateE5Attributes`/`writeClimateE5Sphere`/`resolveParams`/`jetProfile`
  unedited → frozen-bundle golden path byte-identical.
- `GOLDEN_STORM_MASK_HASH` + phase bank — `storm-e.js` has no new alea draw, no edit to
  `stormMaskAt`/`resolveStormE`/`resolvePole`; `#4`/`#5`/`#8` read unchanged fields.
- `bandFlow:rough` is disjoint from every `stormE:*`/`climateE5:*`/`giantD:*` stream — existing
  draw orders undisturbed (stream-disjointness test re-asserts both hashes with the stream drawn).

## Uniform declarations — router-sharing constraint

All 9 new uniforms are declared **inside `HEIGHT_GLSL`'s storm/band section** (never the lab
wrapper or the JS value file): `HEIGHT_GLSL` compiles into BOTH the lab planet material and the
river-router `HEIGHT_FRAG`; an undeclared identifier link-fails the router. Verified live at the
Phase-B gate: raw-WebGL2 compile of the real `HEIGHT_FRAG` string, clean.

## Deliberate non-goals (record-build-intent)

Multi-deck parallax layering (deferred, Max fork 1); true vortex roll-up (fold-not-billow honesty
note, §3.1 — UAT-deferred); real advection of the *storm mask* (aStorm untouched — #4/#5/#8
contract); any `uTime`/animation (program rule).
