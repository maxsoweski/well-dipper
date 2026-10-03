# Review brief — Well Dipper "Galactic Engine" architecture plan (design review, no files to write)

## What you are reviewing
A draft architecture + slice plan for a new renderer for galaxy-scale features (the Milky Way seen from inside /
edge / outside, emission and dark nebulae, giant molecular clouds, supernova remnants) in **Well Dipper**, a retro
(PS1/Saturn-era, 240p, Bayer-dithered) procedural space game in three.js r185 / WebGL2 / raw GLSL, built by Max, a
solo beginner developer directing Claude Code. The plan:
`/home/ax/projects/wd-galactic/docs/FEATURES/galactic-engine-PLAN.md`

Read-only background you may open:
- Current sky code: `/home/ax/projects/wd-galactic/src/rendering/sky/ProceduralGlowLayer.js`, `SkyFeatureLayer.js`,
  `SkyRenderer.js`; `src/rendering/NavGalaxyRenderer.js`; `src/generation/GalacticMap.js` (density model + feature
  placement, kpc galactocentric coordinates); `src/rendering/RetroRenderer.js` (where the sky is drawn into `bgTarget`);
  `src/main.js` search `prepareForPositionAsync`, `beginWarpTransition`, `completeWarpTransition` (per-warp rebuild).
- The sibling World Engine's lessons: `/home/ax/projects/well-dipper/docs/FEATURES/one-pipeline-two-frontends-PLAN.md`
  §1 and `lab-pipeline-into-game-PLAN.md` (why wiring a lab-developed renderer into the game took a month).

## Why it matters (Max's goals)
- Features must read correctly across distance: a small patch far away → filling much of the sky up close → being
  INSIDE one, where it "meaningfully color[s] a huge part of the star field". The Milky Way must look right from any
  vantage point, including far outside the disc.
- Appearance driven by each feature's procedurally generated "history" (age, star population, dust, metallicity,
  supernova), like the World Engine does for planets.
- The same technique must later draw these features top-down in the nav computer's region/sector map views.
- ⭐ Max: lab and game must work "in parallel from day one" — no repeat of the month-long wiring.

## What I want back (your `report` field, Markdown)
Be a demanding graphics engineer and technical lead, not a cheerleader. No praise. Specific and concrete; numbers
where you can; cite file:line when you rely on the code.
1. **Architecture soundness:** is the one-field (`sampleMedium`) + several-views design right? What breaks it?
   Specifically: per-system cube bake vs live raymarch split, the 0.4 ly parallax threshold, precision across kpc→AU,
   feature-catalog-as-data-texture limits (how many features per bake/frame), bake cost inside the warp window.
2. **The transition problems:** where will seams show (bake ↔ near-volume handoff, inside/outside boundary, warp
   crossfade, nav map vs sky) and what design prevents each.
3. **Day-one parallel wiring:** will the plan's rules actually prevent lab/game divergence? What is missing (tests,
   fences, debug hooks, the lab using the game's render path)?
4. **Slice order:** is S1 (one galaxy: field + bake + nav backdrop + lab) the right first slice and the right size for
   a beginner + AI? Should anything move earlier/later? Propose S1's acceptance tests concretely.
5. **History → look:** critique the L1 history fields and L2 render-pack physics (Strömgren, line weights, Sedov,
   dust reddening, pillars). What's missing or over-engineered for a 240p dithered game?
6. **Top 5 changes to the plan, ranked**, each with what it fixes and a rough cost (cheap/medium/expensive).
7. **Risks the plan misses.**
Keep the report under about 2,500 words. Read-only review: write no files; `artifacts` is empty.
