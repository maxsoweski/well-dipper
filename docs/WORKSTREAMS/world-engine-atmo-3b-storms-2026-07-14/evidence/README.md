# Evidence — atmo #3b storms (AC-LIVE / AC-VIS live drives)

Live drives on the atmo worktree lab (`http://localhost:5178/well-dipper/world-engine-lab.html`,
branch `feature/world-engine-atmo-3b` @ `cb69ad4`), chrome-devtools on :9223, 2026-07-15.
Pinned rig unless noted: macroSeed 1 · stormSeed 1234 · pixelScale 1 · sunToCamera ·
viewport 1783×848 @1.25dpr (screenshots 2229×1060). All A/B diffs ran with `jetsEnabled=false`
(F25 drift moves pixels legitimately). Console across the whole drive: zero errors/warnings
(only vite-connect debug + a pre-existing lil-gui form-field a11y issue).

## Slice-landing captures (prior session)

- `slice-va-jovian-bands-storms-live.png` — Jovian bands + placed storms (slice V-α landing).
- `slice-vb-saturnian-hexagon-north.png` — Saturn active-pole hexagon (polar mode).
- `slice-vb-saturnian-southcap-eyewall.png` — Saturn opposite-pole cap + eyewall collar.
- `slice-vb-neptunian-darkspot-companion.png` — Neptune dark spot + adjacent CH₄ companion.

## AC-LIVE (this drive)

- `ac-live-jovian-greatspot-argmax-zoom.png` — great spot (red, crescent-hooked, wake collar)
  on the argmax flank; train pearls on the same band; churned belt boundary. **Argmax
  cross-check (in-page, independent `resolveStormE` re-call with drivers rebuilt from
  `DRIVER_PRESETS`):** `state.spotCenter` == writer primary center bit-exact; primary lat
  −0.4407 rad == `resolveStormPlacement(params).ranked[0].lat` (score 1.0; runners-up 0.932 @
  +0.380, 0.833 @ +0.620); train/pole state == writer records bit-exact.
- `ac-live-reseed-777-{a,b}.png`, `ac-live-reseed-999.png` — storm-path reseed determinism
  (stormSeed via `applyDrivers`): **777 twice → AE = 0** (state bit-identical: spotCenter,
  6 train lons, polarPhase); **777 vs 999 → AE = 95,406 px**, spot lon 2.362→0.610, all train
  lons + polarPhase moved, latitude shared BY DESIGN (frozen-shear carve-out).
- 🎲 **'reroll storm' GUI button** (Features → Legacy synth renderer → Surface — Bands →
  Great spot (F27)): real button click → stormSeed 777→3040093086, vortices re-placed, and
  rendered state == independent `resolveStormE` call at the clicked seed (writer path, not
  the deleted mulberry32 path). No screenshot needed — state parity is the evidence.
- `ac-live-subneptune-haze-muted.png` — hazeMute 0.85 / cloudRegime 2: bands sunk under the
  photochemical haze per #3a; storms placed but veiled.
- `ac-live-uranian-variant-obliq85.png` — Neptunian regime + e5Obliquity 85 (≥80 gate):
  hazeMute 0→0.6, train 1→0, spot radius ×0.6 (0.224→0.134) — the near-featureless read.
- `ac-live-hotjupiter-suppression.png` — enables ALL ON, writer gate zeroes everything:
  spotStrength/trainStrength/polarStrength = 0, trainCount = 0.

## AC-VIS (this drive)

- `ac-vis-a-filamentation-ab-diff-montage.png` — [mask on | `aStorm` zeroed | diff]. The baked
  mask's ONLY GLSL consumer is the filament term (`planet-lod-height.glsl.js` V-α.1), so the
  A/B isolates it: **AE 16,901 px; diff traces thin lines along band boundaries; 68.8% of diff
  mass in the two southern shear-flank row-windows (18.5% of disc rows); 75.9% within ±35 px
  of the 8 writer shear-peak latitudes** (projected to screen rows in-page). Mask zeroed ⇒ term
  vanishes (the disable half of the AC).
- `ac-vis-b-spot-interior-ab-diff-montage.png` — [spot on | `greatSpotEnabled=false` | diff]:
  changed px = **79.2% of the spot core circle (r=154 px), 16.4% of the wake ring (154–310 px),
  0.108% outside** — and the outside residue's bbox is the wake tail on the same band. Interior
  non-flatness: tightest 120×120 core crop stddev 13.6 (range 100–176, ≥3 posterize levels) vs
  ~0 for a flat fill; the diff itself shows the crescent core + graded wake.
- `ac-vis-c-chromophore-two-pearls.png` — one planet, one seed (1234): young pearl age 0.056
  → state color [0.92,0.87,0.79], renders (187,166,138) pale-white; aged pearl age 0.757 →
  [0.81,0.52,0.31], renders (169,127,85) red-brown; primary age 0.907 → [0.77,0.43,0.26]
  deep red (visible in the argmax zoom shot). White→red monotone across three ages live.

## Notes for UAT / later increments

- Filamentation fires on any sheared gas deck with a nonzero mask — gating it to the storm
  enables is a taste call (verifier note, surfaced to Max at UAT).
- GUI macro-seed slider re-bakes the mask but doesn't re-run the vortex block until the next
  `applyDrivers` — transient GUI-only mask/vortex seed skew, self-heals on any driver change.
  Not on the 🎲 reroll path (which is coherent). Someday-item.
- `_lab.setSeed()` reseeds terrain/grain only (by design); storm reseeds go through
  stormSeed + `applyDrivers` (the 🎲 buttons).
