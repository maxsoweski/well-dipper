# AC-LAB live drive — result (PASS)

**Driven by:** working-Claude, 2026-07-17, fresh isolated browser context on :5175 (main checkout,
HEAD `de0c010`, V2-5 build `c64e0cd` + verdict commit). Real GUI paths: preset `<select>` via
`_lab.setPreset`, sliders via the lil-gui DOM inputs (`input`+`change` events), camera via real
wheel events on the canvas. Page closed after the drive; zero console errors or warnings across
the whole session including a mid-drive reload.

## Checks

1. **Preset boots cratered + judgment-ready** — `Moon/Mercury (impact-airless)` present in the
   dropdown (18 presets), boots with `✦ current: relief: writer carrier · craters: writer
   overprint` and `▢ no placeholder dressing enabled` (DEFAULT_DRESSING `[]` honored).
   Full-disk view: battered surface, circular depressions + rims legible, strongest near the
   terminator (as on real airless bodies). `aclab-moon-mercury-boot-c64e0cd.png` (boot),
   `aclab-moon-mercury-fulldisk-seed1.png` (judging distance).
2. **Gravity slider moves the population, correct direction** — native g=0.277 → 0.12: large deep
   basins dominate (`aclab-gravity-low-0.12.png`); → 0.80: fine speckle of small pocks, no big
   basins (`aclab-gravity-high-0.80.png`). Count+size respond visibly; size read rides mainly on
   count at moderate drags (K_GS physical, the documented adjudicable).
3. **Age slider moves the population, correct direction** — age 1.0 Gyr: lightly pocked
   (`aclab-age-young-1.0.png`); age 8.4 Gyr: densely cratered (`aclab-age-old-8.4.png`).
   A/B mode chip correctly reads `OVERRIDE (gravity,age)`.
4. **Frozen carries the overprint (the routed "bumpy" answer)** — fresh reload (overrides
   cleared), Frozen (airless): pocked crater texture over the despun terrain + the ✦ crater
   summary line (`aclab-frozen-overprint-fulldisk.png`). Goldens unaffected (headless-proven:
   83/83 with the seam firing during capture).
5. **Console** — zero errors/warnings (preserved across navigations).

## Caveats for UAT (pre-surfaced, not defects)

- **Small worlds boot as a distant speck** — the lab camera sits at fixed distance 20 and does
  not re-frame per planet radius; a 0.38 R⊕ world needs a zoom-in before judging. Pre-existing
  lab behavior for ALL small presets (Europa, Titan...), not V2-5's. Zoom with the mouse wheel.
- **Crystal also fires the crater gate** (label-free writer; condition-indistinguishable from
  Frozen) — Max's UAT taste call.
- **Crater-size response to gravity is weak by design** (~1.3× over a normal drag; count carries
  the visible response). Boosting K_GS beyond physical = adjudicable taste call.
