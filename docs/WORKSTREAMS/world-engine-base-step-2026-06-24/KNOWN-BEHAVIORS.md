# WS2 base step — known behaviors & calibration decisions

Recorded 2026-06-25 after Max's VIZ UAT. These are **deliberate, documented behaviors** — not bugs.
A future session should not "fix" them without a reason; if one becomes a problem, the fix notes are here.

---

## 1. Same-class worlds share an identical `crustalThickness` layout (discriminator-keyed crust seed)

**Observed (Max, VIZ UAT 2026-06-25):** on `worldengine-fieldviz.html`, *lava* and *magma* show **the same crustal-thickness heatmap** but **distinct regime + grain**. Every other preset pair reads as fully distinct.

**Cause (verified empirically):** the crust noise seed is
`crustSeed = seed + ':crust' + ':' + discriminator`, where
`discriminator = radialStrainSign + ':' + (rockyCrust > 0.5 ? 'sil' : 'ice')`
(`baseStep.js`). So the thickness **layout** is keyed on composition-*class*, not full preset identity. With the viz page's single fixed grid seed, two worlds in the same class get a **byte-identical** `crustalThickness` field.

The 5 presets fall into **3 discriminator classes** (probe at grid seed `fieldviz`, n=128):

| preset | discriminator | rockyCrust | radialStrainSign | radialStrainMag | crustalThickness |
|---|---|---|---|---|---|
| rocky | `1:sil` | 1.0 | +1 | (contraction) | **≡ terrestrial** |
| terrestrial | `1:sil` | 1.0 | +1 | (contraction) | **≡ rocky** |
| lava | `-1:sil` | 1.0 | −1 | 0.624 | **≡ magma** |
| magma | `-1:sil` | 1.0 | −1 | 0.30 | **≡ lava** |
| europa | `-1:ice` | 0.0 | −1 | — | (unique) |

- `lava` vs `magma` crustalThickness: **0 / 16384 cells differ** (byte-identical).
- `lava` vs `magma` regime: **4608 / 16384 cells differ** — driven by `radialStrainMag` (0.624 vs 0.30), so regime/grain ARE distinct despite identical thickness.

**Why it's by design:** this is a faithful port of `relief-base-step.js`. The lab deliberately keys landform *layout* on composition-class so same-class worlds share structure and modulate only amplitude (`relief-presets.js` build-intent: "same seed + different preset ⇒ identical landform LAYOUT, only rescaled in height — EXCEPT regime mix, geometry anisotropy, hydrology"). WS2 preserves that contract.

**Max's call (2026-06-25):** acceptable — "each is distinct" overall; the lava/magma thickness match is fine. AC-VIZ-distinct **PASSED**.

**If it ever needs to change (WS4 or later):** to give same-class worlds *distinct* thickness layouts, fold more identity into `crustSeed` — e.g. a per-body seed, or add `density`/`T_eq` buckets to the discriminator. Do this only if a real consumer needs per-body thickness variety; it diverges from the lab's class-keyed-layout contract, so pin a regression first.

---

## 2. Tidal Io-anchor calibration (`TIDAL_LOG_KNEE = 1.6`)

**Decision (Max-confirmed 2026-06-25):** keep the default. `calibrateTidal(h) = tanh(log10(1+h) / TIDAL_LOG_KNEE)` with `KNEE = 1.6` puts **Io-grade heating (raw ratio 1.0) at ≈ 0.19** on the 0–1 dial.

**Why low, not mid-range:** a low anchor **preserves top-end spread** — inner-moon-grade (~249) reads ≈0.90 and lava-grade (~7.8e5) reads ≈0.999, so extreme worlds stay visibly distinguishable. The dossier's alternative ("Io ≈ mid-range 0.5", `KNEE ≈ 0.55`) is also valid but **crushes the top end** toward ~1.0 (inner-moon and lava both round to ~1.0 visually, though never exactly 1.0 in float).

**Probe values** (the four contract calibration probes):

| input (raw Io-ratio) | `calibrateTidal` @ KNEE=1.6 |
|---|---|
| Earth 1.74e-3 | 4.7e-4 (≈0) |
| Io 1.0 | 0.186 |
| inner-moon 249 | 0.905 |
| lava 7.82e5 | 0.9987 |

Strictly ordered, all in `[0,1)`, no collapse to an identical extreme.

**Tests are property-based** (`AC-F2-tidal-age-calibration`): they assert Earth<0.05, strict ordering, and never-exactly-1.0 — they pass at **any** reasonable KNEE. So retuning Io higher later is a **one-constant change** in `adaptL0.js` with no test churn.

---

*Both behaviors are also flagged inline in `src/worldengine/base/adaptL0.js` (KNEE) and `baseStep.js` (crust seed).*
