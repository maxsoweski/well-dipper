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
- Check 1: (pending)
- Check 2: (pending)
- Check 3: (pending)
- Check 4: (pending)
