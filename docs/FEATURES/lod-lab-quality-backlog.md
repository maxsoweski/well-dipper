# LOD-lab visual-quality backlog — Max's parking-lot (2026-06-15)

> Parked by Max at the end of the STEP-2 cleanup session. **Order of attack is NOT yet
> decided** — that's the first conversation next session. This is the raw observation set,
> captured in Max's words (his per-item phrasing preserved deliberately — it's the spec).
> My triage hypotheses are in a SEPARATE section at the bottom, clearly marked and droppable.
>
> Frame: all of this is **lab renderer** quality work (`planet-lod-lab.html` +
> `planet-lod-lab-core.js`), per the CHARTER — NOT game-wiring. Fits the program's
> **per-feature quality pass** (Phase 2), now expanded by this list.

## Items (Max's words, lightly formatted; numbering is mine for reference)

1. **Terminator gradient** — "looks like a big orange belt around the planet. It should be a
   subtle effect; this isn't working like that."
2. **Planet/moon SIZE + feature-scale normalization** — "We need to consider the size of
   planets/moons. That's going to make a pretty huge difference. E.g., the bigger a planet,
   the smaller craters will appear. And the bigger the planet, the greater the effects of
   gravity and so on. Right now scale feels all over the place, like the size of features
   isn't normalized; often they (especially craters and rivers) make the planet look really
   small because of their relative size."
3. **Rivers & valleys — shape + math** — "Rivers and valleys' shapes need work. The current
   system just does not replicate rivers realistically. The math needs to be updated. There's
   probably math out there for simulating rivers and associated features we can copy."
4. **Gradational features absent on impact/airless bodies** — "Gradational features don't seem
   to appear on Impact/airless bodies at all, though they're turned on."
5. **Sublimation (esp. CH₄)** — "Sublimation needs a lot of work; looks really off for some
   reason especially CH; this seems to be a similar issue to rivers — looks like it's driven by
   a cell system that does not work for this visual feature."
6. **Visible life from space (vegetation / "green stuff")** — "We still have to implement more
   life that's visible from space (like, green stuff) where appropriate, not counting what's
   already in place for fungal worlds."
7. **Canyons too trench-like** — "Canyons are appearing like one long trench; doesn't look
   organic at all."
8. **Water glint at scale** — "The water effect (glinting in the sun) is cool but does not work
   at this scale; that's how an ocean would look from like a mile up, not from space."
9. **Terrestrial cloud variety / banding** — "Cloud cover on terrestrial planets doesn't have
   enough variety/dynamics; the way it bands looks really artificial often."
10. **Lava effect — breathing rate + cell lines** — "The lava effect does not work; the rate it
    'breathes' is too fast (makes the scale seem small) and overall the cell-based system being
    used to generate the lines here just doesn't look like lava at all."
11. **Crystal planets from space** — "Crystal planets wouldn't look like this from space; this is
    another casualty of the cell-based approach currently in use, I'm guessing."
12. **Exotic surfaces — all need reconsidering** — "The exotic surfaces all need to be
    reconsidered; none of these is the right approach; bioluminescence and city lights look like
    liquid flows; ecumenopolis looks like that same cell structure again; machine surface seems
    just to be broken; not even sure what that is supposed to look like."
13. **Non-hazy gas giants — close-up detail** — "The gas giants that are not hazy need to be more
    detailed; from a distance they look good but when we get close the clouds need a lot more
    detail."
14. **Rings — composition + lighting appearance** — "Rings still need a lot of work. We've figured
    out their basic generation but their difference of appearance based on composition and lighting
    have not been worked out at all yet."

## Claude's triage hypotheses (NOT Max's — droppable pointers for the order-of-attack talk)

Two cross-cutting roots seem to underlie many of the 14. Worth weighing whether to attack the
**roots** before the per-feature symptoms. Unverified — to confirm next session.

- **Theme A — a shared cell-based (Voronoi/Worley) noise primitive misapplied across features.**
  Max explicitly fingers "the cell-based system / same cell structure" for #5 sublimation, #10
  lava, #11 crystal, #12 ecumenopolis, and ties #3 rivers + #7 canyons to the same family of
  problem. Hypothesis: one cellular-noise primitive is reused for features that each need
  different generation math (flow networks for rivers/canyons; crystalline facets; molten
  cracks; megastructure grids). A single audit of *which features share that primitive* could
  scope a high-leverage replacement pass instead of 6 separate fixes.
- **Theme B — feature size + animation rate not normalized to planet radius.** #2 is the explicit
  ask; the "makes the planet look small" symptom recurs in #2 (craters/rivers), #8 (water glint
  reads like a mile up), and #10 (lava "breathes" too fast). Hypothesis: feature footprint scale
  and time-rates are absolute, not parameterized by planet size. A scale-normalization pass
  (footprint ∝ 1/radius for craters; animation rate ∝ 1/radius) could move several items at once.
  Also folds in the physics-realism half of #2 (bigger planet → stronger gravity → different
  erosion/relief regime).

Remaining items are more standalone: #1 terminator (tune the gradient down), #4 gradational-on-
airless (gate/driver bug — declared-on but not painting), #6 vegetation-from-space (new content),
#9 terrestrial clouds (variety/dynamics), #13 gas-giant close-up clouds (LOD detail), #14 rings
(composition/lighting maturity — extends the F51 rings v2 work).

## Parked observations (added 2026-06-16, during the Theme-B scale pass)
- **#15 — pixelScale × many-small-features-on-large-planets reads as visual mush.** Once footprint
  scaling is live, a large planet (high RE) packs many small features into the disk; under the lab's
  default `pixelScale` (super-pixel downsample, e.g. 3) + posterize, the fine detail aliases into a
  messy wash. Max flagged this while reviewing the scale gallery and chose to **park it** (may be an
  unavoidable tension between the retro pixel aesthetic and dense detail; revisit after rivers).
  Symptom is a render/pixelScale interaction, not the scale math itself.
- **#3 rivers — ESCALATED to active work (2026-06-16).** Scale recalibration (footprint freq 2.3→4.6)
  made rivers smaller but NOT river-shaped: Max — "rivers run in straight sections and then branch off
  almost like trees when they meet larger bodies of water; these just don't look like rivers." Root
  cause confirmed in-code: F11 `drainageField()` defines channels as the near-zero band of a
  domain-warped FBM field (no flow direction, no downhill coupling, no accumulation) → meandering
  bands, not a dendritic drainage tree. This is the **Theme-A** primitive problem. → researching
  planetary dendritic-drainage generation that's shader-compatible (research deliverable 2026-06-16).
- **#3 rivers — VIABILITY SPIKE PASSED (2026-06-17).** Isolated `rivers-lab.html` proved seam-free
  dendritic drainage on a sphere (G1) that reads as real rivers (G2), both confirmed by Max's eye;
  conform-only suffices, carve not needed (G3). Key finding: requires an **irregular spherical
  Delaunay mesh** (a regular icosphere grid-locks channels into straight lines). Full plan + verdict:
  `rivers-sphere-spike-plan-2026-06-17.md`. **Next: `dev-collab-scope` the full feature** (production
  `h(pos)` coupling + texture-bake + shader sample/carve path) as a new workstream.
- **#2 scale normalization — SHIPPED (2026-06-17).** Theme-B `planet-scale-normalization` workstream
  complete + Max-UAT-passed + pushed: real-units footprints, AC3 relief (physically-plausible × gravity),
  AC4 animation-rate, AC5 seeded size-source (named-body locks vs archetype draws) + slider-fix, AC7 km
  readout. (`#15 pixelScale-mush` still parked.)
- **#10 lava — ESCALATED to the NEXT Theme-A re-think (2026-06-17, Max).** Like rivers (#3), the
  cell-based lava rendering needs a *method* re-think, not a parameter tweak. Max's framing: the
  breathing RATE is NOT the priority — the basic restructuring of the rendering method is. (The AC4
  radius-relative rate lever from the scale workstream may help AFTER the restructuring; the
  absolute-rate-floor adjustment is parked until then.) Next when picked up: a rivers-style research →
  isolated-lab viability spike.

## Status
Parked, untriaged (except **#3 rivers**, now active — see above). Next session opens with the
**order-of-attack** decision for the rest (roots-first vs worst-offender-first).
