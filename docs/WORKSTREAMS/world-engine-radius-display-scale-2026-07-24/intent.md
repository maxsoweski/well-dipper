# Radius display-scale — the planet renders bigger as radius grows

**Workstream:** `world-engine-radius-display-scale-2026-07-24` · **Status:** building (Max's standing greenlight 2026-07-24: "push, then continue with the next increment via workflows")

## Why (line of sight)

The world engine derives worlds spanning 0.3–16 R‑Earth, but the lab renders every one
at the same screen size (`world-engine-lab.html:196` `R = 1.0` fixed; camera distance is in
unit-sphere radii — **no radius→visual-size wiring exists at all**). Size is a primary
"this world is different" cue for the SCREENSAVER heart (distinct, history-coherent worlds
per minute); today that cue is absent, and it's what Max reached for first at the inc3b UAT.

## Success in Max's words (2026-07-24, inc3b UAT)

> "I want, when I move that radius slider to the right, to see the planet on my screen get
> bigger. It's fine that the base mesh doesn't change size."

## DOES / UNLOCKS (Rule 15 card)

- **DOES:** maps `state.planetRadiusEarth` → a visual scale `sVis` applied to the rendered
  sphere (uniform `planet.scale`), with camera distance kept ABSOLUTE so the disc genuinely
  grows; LOD/octave ramps re-keyed on logical distance-in-planet-radii; zoom clamp so the
  camera never enters the scaled sphere. At 1 RE, `sVis = 1` — today's behavior bit-exact.
- **UNLOCKS:** the size read for every radius-varying path that already exists — the manual
  slider (:3902), Moon/Mercury lab re-roll draws [0.27, 0.38] (inc3b R3), and any future
  drawn-radius preset — with zero physics coupling.

## Driver enumeration (per feedback_wire-relevant-drivers-before-uat)

| Driver | Status |
|---|---|
| radius (slider + re-roll draws) | **WIRED** — this is the feature |
| gravity, age, volatiles, tidal, all other D1–D16 | IRRELEVANT — display-only increment; none plausibly sets on-screen size |
| **Known non-goal, surfaced for UAT now:** crater angular sizes remain mesh-floor R-invariant (inc3b finding, bombardment.js `D_FLOOR_KM ∝ R`). On a bigger disc, craters render bigger WITH it — the physical read "bigger world → relatively smaller craters" is NOT delivered here. Max accepted this trade at the inc3b UAT ("It's fine that the base mesh doesn't change size"). | adjudicable, not a surprise |
| Crystal | EXCLUDED — parking lot (Max's standing directive, 2nd issuance 2026-07-24) |

## Settled design (defaults picked, Max redirects at UAT)

1. **Mapping:** `sVis = planetRadiusEarth ^ VIS_SCALE_EXP`, `VIS_SCALE_EXP = 0.5`,
   so 1 RE → 1.0 exactly; 0.3 → 0.548; 16 → 4.0. Rationale: linear spans 53× — at the
   default camera (20 unit-radii) a 16 RE sphere would engulf the view; sqrt keeps both
   ends usable while staying strictly monotone. The exponent is one lab constant — cheap
   to retune at UAT.
2. **Mechanism:** uniform `planet.scale.setScalar(sVis)`; camera distance stays
   `state.distance * R` (absolute) — that's what makes the disc grow. (Scaling the
   camera *in planet radii* instead would exactly cancel the effect.)
3. **LOD honesty:** `lodRampOf` / `autoOctaves` / `lodHysteresis` key on
   `state.distance / sVis` (logical distance in planet radii) so detail tracks apparent
   size; at `sVis = 1` all three are bit-identical to today.
4. **Fence:** `sVis` is DISPLAY-ONLY. It never feeds procgen, height, physics,
   `featureFrequencyFromKm`, or any headless path. Goldens and the full suite must not move.

## Non-goals

- Mesh resolution / mesh-floor changes (accepted as-is by Max).
- Any physics or `planetRadiusEarth` semantic change.
- Game-side (`Planet.js`) port — lab-only per charter.
- Retro-fixing shipped read-gate evidence; instead the staging consequence is documented
  (disc size is now radius-dependent — future recipes must stage radius or disc fraction).
