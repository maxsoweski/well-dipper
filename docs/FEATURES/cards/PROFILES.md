# Profiles Card — per-type feature validation (Phase 6)

For each Appendix-A type: load its lab preset (driver bundle), render, check expected features
PRESENT and wrong features ABSENT, sanity-check derived driver values, verdict.
Regression net: `npx vitest run tests/planet-archetypes.test.js` after any registry/preset change.
Types are presets over drivers (Appendix A) — a profile failure is usually a DRIVER WIRING bug, not
a feature bug.

## Pass of 2026-07-30 (12 of 18 rows walked)

**⚠ Read this before trusting any verdict below.**

**The instrument.** Presence is measured by an **A/B pixel diff against the feature's own enable
key**: toggle `state.<enableKey>` on/off, capture the canvas twice, count pixels differing by >2/255
in any channel, report the fraction of frame. `PRESENT` = >0.05% of frame changes. This is the
"A/B against the dial" method — the picture alone is not evidence.

**⛔ Do NOT use `_lab.featureVisible()` for this.** It is `!featureFolders[key]._hidden` — it reports
whether the **GUI folder** is showing, not whether the feature renders. It returns `true` for
`craters` and `rivers` on a **gas giant**. An earlier run of this pass used it and scored 12/12; that
result was an artifact of the wrong instrument and was discarded.

**Instrument limits, stated so nobody reads past them.** A feature that needs a bake/route step, or a
specific sun/camera geometry, can read `INERT` without being broken. Framing is per-preset: `distance`
is NOT normalised by radius (Earthlike frames at ~2.1, Jovian needs ~6.5). Screenshots were taken for
Rocky, Titan, Jovian only — not the full `shots/PRO-<type>-NN.png` set the card originally asked for.

| Type | Lab preset | Must show | Verdict (2026-07-30) |
|---|---|---|---|
| rocky | Mars (arid rocky) | F1 F2 F3 F5 F8 F19 F40 | **PASS w/ notes** — F1 .11, F2 .017, F3 .065, F5 .069, F40 .028. F8 lava INERT (`lavaEnabled:false` by dressing — correct for Mars, extinct volcanism; the row's F8 was written for a generic rocky type). F19 mass-wasting INERT (.00006). |
| terrestrial | Rocky (Earthlike) | F11 F12 F14 F17 F26 F31 F34 F35 F37 | **PASS w/ 1 OPEN** — F14 .011, F26 .128, F31 .0017, F34 .074, F37 .00095. **OPEN: F11 rivers + F12 deltas INERT (.00014/.00015) while drivers derive `fluvialActivity 1.0`, `fluvialDensity 0.578`** — drivers live, pixels don't move. F17 glacial INERT and that is CORRECT: the seed-1 draw is **T_eq 313.9 K (41 °C)**, no ice. F35 terminator INERT — **Max disabled F35 outright 2026-07-16**, expected. |
| ocean | Ocean (temperate) | F14 F20 F36 F31 F34 | **PASS w/ notes** — F14 .187, F20 .050, F31 .0019, F34 .077. F36 sunglint INERT (.00023) — a specular glint needs the sun in the mirror direction; **not verified either way**, the test geometry probably cannot show it. |
| ice | Europa (icy moon) | F2 F9 F10 F17 F18 | **PASS** — F9 .094, F10 .112, F17 .117, F18 .047. F2 craters INERT and that is CORRECT: `craterDensity 1.4e-6` on a young resurfaced shell (resurfacingRate 0.6). The condition-derived crater gate is doing its job. |
| lava | Lava (hot airless) | F8 F41 | **PASS** — F8 .066, F41 .031. |
| venus | Venus (sulfuric shroud) | F31 F7 F29 F25 | **PASS** — F31 .335 (the blanket dominates the frame, as intended), F7 .062, F29 .054, F25 .055. |
| carbon | Carbon (high C/O) | F42 | **PASS** — F42 .125. |
| gas-giant | Gas giant (Jovian) | F24 F25 F27 F28 F29 F30 | **PASS w/ notes** — F24 1.000 (whole-globe), F25 .053, F27 .127. **F28 .0026, F29 .0028, F30 .0028 are PRESENT but FAINT** — barely over the 0.0005 floor. Screenshot reads decently: zonal bands, great spot, secondary storm, polar shading. |
| hot-jupiter | Hot Jupiter (locked giant) | F32 F33 F24 | **PASS** — all three 1.000 (whole-globe thermal + bands). |
| eyeball | Eyeball (locked temperate) | F31 (F22) | **PASS** — F31 .030. **F22 DOES NOT EXIST** in the FEATURES registry (see doc bug below). |
| sub-neptune | Sub-Neptune (hazy) | F31 | **PASS** — F31 .171. |
| crystal | Crystal (faceted) | F43 F3 | **PASS** — F43 .021, F3 .0069. |
| hex | — none — | F44 | **BLOCKED — no preset, no archetype.** |
| shattered | — none — | F45 F9 | **BLOCKED — no preset, no archetype.** |
| fungal | — none — | F46 | **BLOCKED — no preset, no archetype.** |
| machine | — none — | F47 | **BLOCKED — no preset, no archetype.** |
| city-lights | — none — | F48 | **BLOCKED — no preset, no archetype.** |
| ecumenopolis | — none — | F49 | **BLOCKED — no preset, no archetype.** |

## Corrections to prior claims about this card

- **"AUTHOR in Phase 6" was stale, but "all 18 presets now exist" was ALSO misleading.**
  `DRIVER_PRESETS` does have 18 entries — but the PROFILES **type** list and the `PRESET_ARCHETYPE`
  list are different lists that drifted apart. 12 rows are walkable; **6 have no preset at all** and
  need F44–F49 built first. Those 6 are exotic/artificial types, not "common types", so they are not
  the gate.
- **3 presets are absent from `PRESET_ARCHETYPE`** (15 mapped of 18): `Mars (arid rocky)`,
  `Moon/Mercury (impact-airless)`, `Hot Jupiter (locked giant)`. Walkable by preset name only.
- **2 archetypes have no PROFILES row:** `volatile` (Titan) and `stagnant-lid` (Venus — the `venus`
  row reaches it by preset name).
- **Doc bug: F22 is referenced by the terrestrial, ice and eyeball rows but no feature is labelled
  `(F22)`** anywhere in the registry. Either the ID is wrong in this card or the feature was never
  built.

## Open items ranked

1. **F11 rivers / F12 deltas on terrestrial** — the only finding where derived drivers are healthy
   (`fluvialDensity 0.578`) and the render does not move. Rivers are a separate overlay mesh
   (`setRiverOverlay` / `createRiverOverlay`), so `riversEnabled` may gate only the shader term while
   the visible ribbons come from the overlay — i.e. possibly an instrument limit, possibly a real
   disconnect. **Not yet diagnosed; do not assume either way.**
2. **F28/F29/F30 faint on Jovian** (~0.3% of frame) — check whether that is intended subtlety.
3. **F36 sunglint** — needs a sun/camera geometry that can actually produce a specular glint.
4. The 6 BLOCKED rows — each needs a preset authored AND its F44–F49 feature built.

## 7. Verdict + tweak log
2026-07-30 — first real pass. 12 rows walked, 10 PASS / 2 PASS-with-open-item, 6 BLOCKED. One
methodology correction recorded above (`featureVisible` is not a render probe). No code changed by
this pass; it is measurement only.
