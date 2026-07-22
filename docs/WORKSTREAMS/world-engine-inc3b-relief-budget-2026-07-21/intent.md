# world-engine-inc3b-relief-budget-2026-07-21 — intent

**Workstream:** `world-engine-inc3b-relief-budget-2026-07-21` · L1 tree, `feature/world-engine-production-L1`
**Status:** SCOPED 2026-07-21 from panel `wf_fa5bfba8-73d` + Max's four scope-interview rulings — **AWAITING MAX GREENLIGHT**.
**Line of sight:** JOURNEY → World Engine "condition-first history systems" objective; PLAYER_EXPERIENCE → the ground-truth
planet-LOD lab. This is the Inc-3 follow-up: Inc-3 shipped the correct crater *physics* but it rendered invisible; this
increment makes it *seen*.

## Why we care

Inc-3's UAT failed. Max, verbatim (numbered against the recipe — 1 = Moon/Mercury read, 2 = Frozen, 3 = re-rolls vary):

> **"1. No, still looks the same 2. Frozen looks just like 1, and just how i remember it but with a different color
> pallette 3. They do not, as far as i can see"**

Opening this session, Max:

> **"I would like to understand the vast disparity between what that last session thought it was handing to me to test
> and what I actually received. One other thing I'm noticing: on the moon/mercury preset I'm also getting those
> plateau-like landforms made for venus"**

The disparity is now diagnosed and filed (fresh processing session, commit `041d7a8`), measured not hypothesized:
**craters are ~1.5% of the composited relief budget** under the generic despun "tectonic-build" terrain (the Venus-like
plateaus are that writer's `:e6plateau` crust term rendering on Moon/Mercury), and — because `compositeMargins` sums
channels 1:1 and `uPerturb` scales the sum — **the crater:base ratio is envelope-independent**. No envelope value, and no
depth-law fix, could rescue a layer sitting at ~1% RMS. The right physics was drowned by a base channel ~500× above the
real Moon's relief.

The program bar (charter INTENT FRAME) is **physics-first**: derived laws, real-body anchors, no taste constants. Max's
gates are the two he owns — **greenlight** and **UAT**.

## Success criteria (Max's language)

- Moon/Mercury no longer **"still looks the same"** — at oblique light it reads as a **heavily-cratered small world**,
  with craters (not the despun terrain) the dominant relief.
- The **"plateau-like landforms made for venus"** are gone from Moon/Mercury.
- Frozen no longer reads as **"just like 1... with a different color pallette"** (and we tell Max up front, honestly,
  that this increment leaves Frozen statistically *near* Moon/Mercury — real distinctness is deferred, not promised).
- Re-rolls visibly vary: his **"They do not, as far as i can see"** becomes *they do* (layout + largest-basin draw, and
  now radius — see ruling R3).
- The **"vast disparity"** between what a session hands to test and what Max receives is closed by a perceptual
  read-gate run — with thresholds frozen before capture — *before* any UAT ask.

## Rulings folded (Max, 2026-07-21 scope interview)

- **R1 — Mars/Crystal ride-along (accepted rec):** let Mars and Crystal ride under the law with **before/after captures
  at S4 as an explicit UAT checkpoint** — presented, never silently shipped.
- **R2 — full-phase (accepted):** a face-on lit disc reads near-featureless pre-albedo; **albedo/ejecta stay deferred to
  the exogenic increment.** The UAT recipe pins oblique lighting and files a full-phase control capture as the honest
  pre-albedo state.
- **R3 — radius unlock:** **Moon/Mercury radius is UNLOCKED** — removed from the `NAMED_BODY` lock for the LAB draw only,
  seeded over the **[0.27, 0.38] R⊕** band (the preset has no archetype, so it gets its own range entry, not the
  archetype table). Max's framing, verbatim: **"i thought the names in the lod lab were just archetypes, not supposed to
  be simulating one specific body?"** — the archetype reading is the product intent; remaining `NAMED_BODY` locks are open
  to the same treatment in later increments (headless calibration never needed the lab lock — it passes canonical radii
  explicitly). Other presets stay locked this increment.
- **R4 — conditional slice is DIAGNOSE-FIRST**, Max verbatim: **"i do not want to just accept the old framework; if this
  is not working I want to diagnose and fix. That may mean addressing something like the scale of the rendering or
  something, which I am open to if that's our issue (or something along those lines)."** So S3 is **not** "adopt the
  F2-adapted legacy texture." On an S2 read-gate texture-fail, S3 = a **root-cause diagnosis** (content vs instrument),
  fix scoped at the convicted layer; legacy-F2 adoption is **not pre-authorized**; rendering-scale/instrument fixes are
  explicitly in-domain.

## DOES / UNLOCKS (Rule 15 card)

**DOES:** at the composite seam (`planet-lod-rivers.js` `compositeMargins`), **reallocates relief variance** via a
*derived* crater:base variance-ratio law `f_I(cond)` — a new condition-scalar leaf `src/worldengine/base/reliefBudget.js`
— suppressing the endogenic despun share so **craterField becomes the dominant slope signal at preserved total composite
amplitude** (no channel physicalized on screen; the `reliefEnvelope` display compressor and the writer bytes are
untouched). Binds a pre-frozen **oblique-light read-gate before any Max ask**. Unlocks the Moon/Mercury LAB radius draw
(R3).

**UNLOCKS:** Inc-3's correct-but-invisible crater physics becomes visible (the ~39:1 gradient deficit inverts, no world
flattens, no world blows past the Phobos extreme); a legible cratered base for the **exogenic-dressing increment**
(albedo / ejecta / bright-rim rays, and the ice-D_t Frozen differentiator) to build on; radius variety judgment relocated
to a body that can express it (Frozen + the newly-drawable Moon/Mercury radius).

## Deliberate non-goals

- **Albedo / ejecta / bright-rim rays** → fenced channel, exogenic increment (full-phase disc stays near-featureless
  pre-albedo — R2).
- **Ice-D_t crater flattening** → later icy increment (panel P6): it would flatten Frozen craters 2.4× exactly when
  we're fighting for crater read, and its fence impact is re-capture-shaped/unadjudicated.
- **Stamped-rim work, uPerturb/normal boosts** → sub-node geometry and taste constants respectively.
- **Other `NAMED_BODY` radius locks** (Mars, Titan, Europa, Magma, Venus, …) stay locked this increment — only
  Moon/Mercury unlocks (R3).
- **Figure / limb re-roll variety** → its own scoped increment, only if S4's variety AC fails.
- **S3 is conditional and diagnose-first** — no peppering / legacy-F2 mechanism is pre-authorized; it is built only on an
  S2 texture-fail, at the layer a root-cause diagnosis convicts (R4).
- **Atmo-lane sections** of `planet-lod-lab.html` (section-ownership fence) and **NOT-OURS** files
  (`src/auto/CameraChoreographer.js`, `src/debug/LabMode.js`) — never touched, never staged.
