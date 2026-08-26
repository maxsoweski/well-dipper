# AC-LAB — live result (2026-07-05)

**Gate:** AC-LAB (integration, live: true) — the objective in-browser sweep. Verified by
working-Claude driving the running lab; **this is NOT Max's UAT gate** (AC-UAT stays
deferred-to-max).

**Env:** dev server `localhost:5173/well-dipper/world-engine-lab.html`, real Windows Chrome via
WSL interop on `127.0.0.1:9223` (real GPU — WebGL renders; the Linux `google-chrome` path is
WebGL2-blocklisted and must NOT be used). HEAD `1995dbb`.

**Drive:** Venus preset (routes stagnant), `setSeed(1234)`, `reliefBakeStrength(1)`,
`rebuildTarget()`, `stagnantLidProbe()`.

⚠ Gotcha discovered: the prior session left the thermal driver override elevated
(`setVolcanicThermal(0.85)` persists across preset changes — it lives in `driverOv.thermal` +
`_driverTouched`, NOT `state.thermalState`). A fresh probe therefore reads as *driven*, not
baseline. **Call `volcanicThermalOff()` + `rebuildTarget()` first** to get a true untuned baseline.

## Observable

| Metric | Baseline (thermal OFF) | Driven (thermal = 0.85) |
|---|---|---|
| `appliedTune` | **null** (byte-identical) | **{TESSERA_FRAC 0.075, CORONA_ACTIVE_FRAC 0.851, CORONA_POOL 182, PLUME_MIN 9}** |
| `regime` | venus-stagnant-lid | venus-stagnant-lid |
| `coronaCount` | 452 | **842** |
| `activeFrac` | 0.648 | **0.874** |
| `plumeCount` | 11 | **14** |
| `tesseraFrac` | 0.075 | 0.075 |
| `varExplainedByLatitude` | 0.0107 | 0.0087 |
| `varExplainedByPlume` | 0.246 | 0.251 |
| `orderingHolds` | true | true |

## Verdict — PASS

- `appliedTune` is **null at the untuned Venus baseline** (byte-identical) and **non-null when the
  thermal lever is driven** — the tune activates only under drive.
- Under drive the province mix moves the **correct direction** (more active coronae, higher active
  fraction, more plumes).
- Variance is **plume-explained, not latitude-banded** (`veLat 0.0087 ≪ vePlume 0.251`) — the
  AC3 falsifier holds; the tune did not re-introduce sin²(lat) banding.
- `orderingHolds` true throughout (anti-mush ordering preserved).

Screenshots: `AC-LAB-baseline-thermal-off.png`, `AC-LAB-driven-thermal0.85.png` (this folder).

**Note on the tessera lever:** the optional `volatiles`/`T_surf` lil-gui sliders (DOM-only, no
`_lab` setter) were not separately driven — not required; the build handoff notes the thermal
lever alone carries the AC-LAB gate. Headless AC-TUNE-RESPONSE already proves the V/age tessera
limbs.

**Next:** Max's UAT (AC-UAT) — open the lab on Venus with baked relief, drive the sliders, judge
whether a driver-varied stagnant world reads varied within itself and distinct from Venus. UAT
green → Shipped.
