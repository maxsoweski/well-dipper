# stage-d-provinces-2026-06-10 — intent

**Authored in autonomous mode (2026-06-10):** Max delegated scoping decisions for this
workstream ("execute a plan for the provinces implementation … without me needing to
watch over your shoulder"). "Why we care" and the success criteria below are Max's own
recorded words (index §8, 2026-06-07 + handoff 2026-06-10); design decisions taken on
his behalf are marked **[ASSUMPTION]** and queued for his Phase-7 review lap.

## Why we care

Max, 2026-06-07: every relief/domain feature is "evenly distributed" across the whole
sphere — "slop laid over slop" — instead of the **distinct areas** real bodies show
(Moon maria-vs-highlands, Mars hemispheric dichotomy + Tharsis). His framing for this
session: "have the next session first figure out regions as a goal so that these
planet-sized features stop being an issue — e.g., a full planet-sized grid of lava
cells." This is an architecture limitation, not a tuning problem: the missing thing is
a layer ABOVE the features. The per-feature work built the vocabulary; provinces are
the grammar — which features cluster where.

## Success criteria (Max's language where recorded)

- Planet-sized features "stop being an issue": large-scale **distinct areas** appear —
  a feature clusters into regions instead of tiling the globe evenly. (Spike validated
  the direction 2026-06-10: Rocky A/B, smooth-vs-rough dichotomy, shots
  `stageD-spike-rocky-03/04`.)
- Provinces are **soft weight fields, not hard type-switches** — Stage-A's
  blend-not-branch frame holds (index §8 load-bearing constraint; a deliberate frame
  decision, made consciously here).
- Provinces are **feature-poor**: each region shows a subset of features, so weight is
  per-feature (`provinceWeight(FEATURE_ID)`), not one global scalar (registry row).
- **No combiner signature changes** — Stage-D swaps the reserved no-op scalar for the
  spatial field; combiner bodies keep their multiply (registry/index convention).
- The F08 ad-hoc lava province mask is **subsumed** by the shared field — no second,
  divergent province mechanism survives (handoff flag; spike confirmed stacking
  masks intersects to near-nothing).
- The 15 Phase-3 verdicts stay the regression baseline: with province influence dialed
  to 0 the legacy look is intact; presets re-verified by spot-check, not full
  re-judging.

## Design decisions taken autonomously

- **[ASSUMPTION] Field mechanism:** decorrelated low-frequency FBM threshold fields
  (the codebase's existing region idiom — F08 province, F9 chaos region, F22 cap mask)
  rather than Voronoi terranes. Criteria: soft-by-construction (the §8 constraint is
  native to smoothstep thresholds), proven in this shader, cheapest (combiners already
  pay for `noised()`). Voronoi terranes remain a Phase-7 alternative if Max wants
  plate-ish geometry.
- **[ASSUMPTION] Affinity model:** per-feature {field index, polarity, floor} constants
  in GLSL, mirrored as data in `planet-archetypes.js` so vitest pins coverage. Floor
  keeps a feature faintly present outside its province (feature-poor ≠ feature-absent).
- **[ASSUMPTION] `uProvinceWeight` becomes the global province-influence dial**
  (0 = legacy uniform look, 1 = full provinces, default 1) — preserves its
  "multiplier, not gate" semantics and doubles as the regression escape hatch.
- **[ASSUMPTION] Per-feature affinities are global constants in v1**, not
  per-archetype data; archetype character keeps flowing through the existing strength
  drivers. Per-archetype affinity tables are deferred until Max reacts to v1.
