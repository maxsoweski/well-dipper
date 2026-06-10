# Foundation Card — substrate UAT (Phase 2)

Everything every feature inherits. Feature tweaks cannot compensate for a wrong
substrate. Judged in the lab on :9223 (GPU Chrome; liveness via list_pages).
Bar: "reads right in the 6-level posterized envelope" — form/behavior, not pixels.

## Check 1 — Base FBM continents
View: preset "Rocky (Earthlike)", distance 20, then 8. Reroll seed 3×.
Judge:
- [ ] Landmasses read as continents (coherent shapes, natural coastline complexity)
- [ ] No visible tiling, axis-aligned banding, or pole pinching
- [ ] Reroll produces varied but same-character worlds
Reference: Earth/Mars albedo maps (dossier-style refs in shots/ captions).

## Check 2 — Lighting model
View: preset "Rocky (Earthlike)", distance 8; drag-rotate the planet (light is world-fixed; rotating the planet moves the terminator).
Judge:
- [ ] Terminator position matches light direction; shading follows displacement
  (ridges lit on sun side, shadowed opposite)
- [ ] No inverted/flat normals at poles or seams
- [ ] Analytic-derivative normals stay stable while zooming (no shading pop)

## Check 3 — Posterize + 4×4 Bayer envelope (F50)
View: any preset, distance 12, slow auto-rotate ~30s.
Judge:
- [ ] 6 levels read clearly; dither pattern stable (no shimmer/crawl while rotating)
- [ ] Gradients quantize into deliberate bands, not accidental contours
- [ ] Envelope flatters rather than crushes relief shading (compare via the
  Envelope folder per-term bypass checkboxes — a full off-toggle is deferred)

## Check 4 — LOD ramp (F53 scaffolding)
View: preset "Rocky (Earthlike)"; sweep window._lab.state.distance 20 → 2 → 20.
Judge:
- [ ] Detail octaves rise/fall smoothly; no popping at thresholds (hysteresis works)
- [ ] No fizz/aliasing at limb or horizon at close range (fwidth clamp holding)
- [ ] window._lab.lodRampOf(distance) values monotonic across the sweep (log values)

────────── §7 verdicts (filled during Phase 2) ──────────

## 7. Verdict + tweak log
- Check 1: 🟢 2026-06-10 — Rocky (Earthlike), d20 + d8 + pole view + 3 macro-seed
  rerolls (4242/77/8888). Macro octaves produce coherent continental-scale
  highland/lowland masses with irregular natural boundaries; no tiling, no
  axis-aligned banding, no pole pinching (pitch-1.4 view clean); rerolls vary
  the arrangement while keeping the rocky-terrestrial character. Note: no
  sea-level/ocean fill in the substrate (that's F14, Phase 4a) — "coastline"
  judged as macro height-region boundary complexity per the form-not-pixels bar.
  Shots: FOUNDATION-check1-01-d20.png, -02-d8.png, -03-pole.png,
  -04-reroll1.png, -05-reroll2.png, -06-reroll3.png.
- Check 2: 🟢 2026-06-10 — Rocky (Earthlike) d8, yaw 0/2/4 phase sweep + zoom
  series d8/5/3/2. Light uLightDir=(0.61,0.35,0.71) world-fixed; observed
  phases match quantitatively (yaw0 ≈ full disc lit from upper-right, yaw2 ≈
  half phase lit screen-left at ~74° camera-light angle, yaw4 ≈ night side
  with thin lit rim). Ridge/crater shading follows displacement (sun-facing
  slopes bright, opposite shadowed) at every distance; pole view (check1-03)
  shows no inverted/flat normals; no seam artifacts. Zoom stills show detail
  octaves arriving without shading-character flips (method note: stills can't
  fully rule out temporal pop — ramp monotonicity is logged in Check 4).
  Shots: FOUNDATION-check2-01-yaw0.png, -02-yaw2.png, -03-yaw4.png,
  -04-d5.png, -05-d3.png, -06-d2.png.
- Check 3: (pending)
- Check 4: (pending)
