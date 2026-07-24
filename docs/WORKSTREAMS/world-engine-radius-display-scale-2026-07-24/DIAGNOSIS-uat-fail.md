# UAT-FAIL diagnosis — radius slider reliability + terrain scaling (2026-07-24)

Max's verbatim: "The radius does not reliably go up when I move the slider, and the terrain
features appear to scale up with the radius. Something ain't working here. Did you test this?
Did you build a plan for verifying what a correctly-radius-scaling planet would look like as
the radius is tweaked?"

## Finding 1 — the wire responds; the slider's UX math is the reliability problem

Reproduction on the live :5175 lab (isolated page, closed after):

- Synthetic PointerEvent drags do NOT register on lil-gui (untrusted-input limitation of the
  test harness — NOT a product finding, but it exposed that the shipped "live" AC never
  exercised real pointer input).
- A **trusted** click at track center: radius 0.819 → **7.98** (mid-track = 8.15; within one
  pixel). sVis followed (2.825). The value→display chain works under real input.
- **The track is 79 px wide for a linear 0.3–16 RE range** → **0.199 RE per pixel**:
  - The band where every canonical world lives (0.3–2 RE) is the leftmost **8.5 px**. One pixel
    of drag there jumps the radius ~0.2 RE — at 0.3→0.5 RE that's a +29% disc jump per pixel.
  - The right half (8→16 RE, ~40 px) produces total disc growth ×1.41 under the √ mapping —
    **~0.9% disc growth per pixel**, sub-perceptual per drag tick.
  - Net drag experience: violent jumps at the left, then a long flat zone where "nothing
    happens" — plus the ~500ms async route re-derivation making terrain pop in late.
    "Does not reliably go up" is the predictable read of that curve.

## Finding 2 — uniform scale is a "closer" cue, not a "bigger" cue (design error)

`planet.scale.setScalar(sVis)` scales macro terrain 1:1 with the disc. Feature-to-disc
proportion never changes, so the render is nearly indistinguishable from moving the camera
closer — the one visual signal of "bigger planet" (features becoming RELATIVELY smaller
against a larger disc) is absent by construction. The fine texture features
(featureFrequencyFromKm, keyed on real R) already carry the correct relative proportion; the
macro height field (continents, stamped basins — angular-fixed noise on the unit sphere) is
what reads wrong.

Contract accountability: working-Claude extended Max's inc3b acceptance ("it's fine that the
base mesh doesn't change size" — a mesh-RESOLUTION acceptance) into cover for uniform feature
scaling. Max never signed that. The perceptual model was never written; every objective AC
verified the chosen mechanism, so all 8 passed while the feature failed its purpose.

## What "correct" looks like (the model Max asked for — DRAFT, needs his sign-off)

As the radius goes up, at fixed camera:
1. **Disc grows** (mapping curve = taste knob).
2. **Feature angular size stays ~constant** → features get RELATIVELY smaller vs the disc;
   **more of them are visible**. This is THE size cue.
3. **Relief fraction shrinks** (mountains on a big world are relatively lower — the g-coherent
   envelope already points this way).
4. Slider ergonomics: perceptually uniform response across the track (log-position slider
   and/or per-pixel growth roughly constant), no dead zone.

Verification plan for the fix build: a frozen A/B read-gate BEFORE build (per
feedback_perceptual-read-gate-before-uat) — same world at 3 radii, blind agents must order
them by size from the renders alone; plus a "closer vs bigger" discrimination pair (scaled-up
current build vs radius-keyed candidate at matched disc size).

## Disposition

- Status back to `building`; the shipped uniform-scale display stays in the tree pending Max's
  model review (it is identity at 1 RE and harmless to canonical worlds, but its cue is
  misleading at non-1 radii — Max may prefer revert-first).
- Next artifact = the perceptual model spec above, presented to Max for sign-off BEFORE any
  fix build. Fix scope after sign-off: macro-terrain radius keying (real procgen work — needs
  its own increment + read-gate) + slider ergonomics.
