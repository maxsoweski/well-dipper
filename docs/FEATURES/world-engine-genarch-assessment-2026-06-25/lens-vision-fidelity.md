# Lens: VISION-FIDELITY — stress-test of the gen-arch recommendation

**Date:** 2026-06-25 · **Mode:** READ-ONLY (no code edited) · **Posture:** default-skeptical, trying to REFUTE.
**Question:** Does the recommended direction (Option A — port the baked `height` substrate into the renderer) truly
deliver "a planet with a tectonic history readable as data," or does it just move the same noise-orientation problem to a
new layer? Would Max's UAT pass it?

**Audited against:** `world-engine-architecture-spine.md` §0/§1 (the north star, Max's words), the NOW.md WS4 UAT block
(`docs/NOW.md:33`, Max's actual UAT verdict), and the WS4 intent.md north-star bar
(`docs/WORKSTREAMS/world-engine-relief-wiring-2026-06-25/intent.md:12–16`, Max's words).

**Verdict: NOT REFUTED — but the recommendation's HEADLINE FRAMING over-claims, and one load-bearing argument
(the slice UAT pass) does not prove what the recommendation leans on it to prove.** The *direction* survives the vision
lens; the *rhetoric around it* does not. Details below.

---

## 1. What the north star actually demands (re-derived from source, not from the ASSESSMENT)

Three texts, in Max's own words, define the bar. They are NOT identical — and the gap between them is where the
recommendation's framing strains.

- **Spine §0 (the full vision):** *"what you see … is the billions-of-years history of that object … the generative
  world engine is a kind of 'story engine' … users 'read' the story by looking at it."* Design consequence (§0):
  *"Borrow settled planetary-science scaling to place plausible structure once per body."* Note the word **structure** —
  not "orientation," not "amplitude," but *structure*.

- **WS4 intent.md:12–13 (Max's north-star BAR, the most concrete statement):** *"you can see the results of the forces
  that formed it — whether that's the major continental shapes on Earth, the mountain ranges, plateaus, plains … or the
  surface features of Pluto where you can see ice mountains, ranges of those, and regions that are smoothed over."*
  This bar explicitly names **continental shapes** and **named regions** (Sputnik Planitia) as the thing you should be
  able to read.

- **WS4 intent.md:15–16 (the SCOPE honesty — critical, and the ASSESSMENT under-weights it):** *"WS4 is a milestone
  toward that bar, not the whole bar … WS4's concrete move toward the bar is: the relief features read as ONE coherent
  tectonic system (ranges/scarps/canyons share a grain and amplitude provinces, not random scatter) AND drainage has cut
  into that relief. Fuller landform variety — **Earth's continental shapes (plate tectonics)** … **comes from engines
  NOT in this campaign (E7/E8/E11…) and is explicitly later work.** WS4's UAT judges the grain+drainage read as a
  coherent step, not the finished planet."*

**Max's actual UAT verdict (NOW.md:33, his words paraphrased by working-Claude):** the procgen layer *"generates only a
THIN latitude-banded **orientation** grain + scalars — NOT a tectonic structure / history as DATA; the relief is
shader-synthesized noise merely *oriented* by the grain, so it reads as an orientation overlay, not 'a planet with a
tectonic history.'"* The fault Max named is **"relief is shader-synthesized, not data."** He did NOT name "the relief
lacks continents" — he named the *channel* (synthesized vs data), exactly the diagnosis the recommendation makes.

---

## 2. Does Option A move the problem, or solve it? — the decisive code check

**The recommendation's core claim is verifiable, and it is TRUE at the channel level:**

- WS4 today: grain enters the shader ONLY as a direction — `mix(uOrogenyAxis, normalize(sampleGrainStrike(pos).xz),
  uTectonicGrainStrength)` (`planet-lod-height.glsl.js:949`), and the relief HEIGHT is still synthesized by the in-shader
  `noised()` combiners the grain merely re-aims (the `fbmdRidged` octave loop, `:963–980`; `drainageField` is also pure
  in-shader noise, `:995–1010`). The substrate's `height` array reaches NO renderer. **Confirmed first-hand.**
- The slice: `runE6` WRITES `substrate.height[i] += baseAmp * h * blend` (`relief-e6-tectonic.js:122`); E9 CARVES the
  SAME array `substrate.height[i] -= dz` (`relief-e9-hydrology.js:139`); the lab renderer displaces vertices DIRECTLY
  from `substrate.height[i]` and is **preset-blind** (NOW.md:668). **Confirmed first-hand.**

So Option A is NOT "the same noise-orientation problem at a new layer." It is a categorically different data path: a
height array that engines BUILT and CARVED, sampled by the renderer, vs a height the fragment shader INVENTS. On the
exact axis Max's UAT named (synthesized-vs-data), Option A crosses the line WS4 did not. **The "moves the problem"
refutation FAILS.**

**BUT — and this is the lens's real finding — Option A's height carries far LESS "tectonic structure" than the headline
implies.** The slice's `runE6` height is composed of exactly two ingredients (`tectonic.js:113–117`):
1. `steeredNoise(noise, x, y, grainAngle[i], regime[i], …) * grainMag[i]` — **2D Simplex noise, oriented by the
   latitude-banded grain.** This IS noise; it is oriented noise *baked into an array* instead of oriented noise
   *synthesized in-shader*. The difference that matters is that it is then PERSISTED and CARVED — but the macro-shape of
   THIS component is still noise, just frozen.
2. `plateau = max(0, thicknessBlob(ix,iy) - 0.55) * 1.6` — the ONLY genuine 2D macro-structure source. And
   `thicknessBlob` is a low-frequency 2-octave Simplex field (`baseStep.js:77–82`) that is **composition-class-keyed,
   not per-world:** *"two worlds in the same class get a BYTE-IDENTICAL crustalThickness field (e.g. lava ≡ magma both
   '-1:sil'; rocky ≡ terrestrial both '1:sil')"* (`baseStep.js:68–73`, the authors' own flag).

So the macro-structure Option A would bake is: **low-frequency noise blobs (class-keyed) + oriented mid-frequency
noise + carved drainage.** That is genuinely "structure as data" in the plumbing sense, and it is genuinely a step up
from in-shader noise. It is NOT "continents with a tectonic history" — there is no plate, no boundary, no craton, no
fault-trace as an explicit object. The recommendation acknowledges this (the §9 E6-scope flag and Option C), but the
**headline §1 and the verdict bury it.**

---

## 3. The two places the recommendation's framing over-claims (weaknesses, not refutations)

### Weakness 1 — the headline says the slice "HONORS the vision" and "ARE 'procgen writes structure as data'"; the slice's *height content* is mostly frozen oriented-noise + class-keyed blobs.

The §2 table marks the slice "**HONORS** (the only one)" and §1 says the four locks *"together ARE 'procgen writes
structure as DATA, render reads it.'"* That is true of the **discipline** (substrate + host-editor + carve), and it is
the right structural verdict. But a vision-lens reader holding intent.md:13 ("major continental shapes on Earth") in mind
will hear "honors the vision" as "delivers readable tectonic history," and the slice's height does not deliver that — it
delivers carved, oriented-noise relief that diverges by body class. The honest claim is narrower: *the slice honors the
**data-flow discipline** the vision requires; it does not yet honor the **content** (plate-shaped macro-structure) the
vision's own examples name.* The recommendation makes this distinction in §9/Option C but not in the headline a reader
will anchor on.

### Weakness 2 — the recommendation leans on "the slice was Max-UAT-PASSED" as evidence Option A will pass; but the slice's UAT tested a DIFFERENT proposition than WS4's UAT failed.

The recommendation repeatedly cites "Max-UAT-PASSED in the relief slice (2026-06-23)" as proof the architecture satisfies
the vision (§1, §3, §7). Checking what that UAT actually was:
- The **divergence** UAT (`ef63554`, NOW.md:663) passed on the words **"they all read as distinct"** — i.e. body-TYPE
  DIVERGENCE, on a **FLAT 2D latitude-band DEM** (NOW.md:633–634, explicit caveat: "Flat 2D … NOT sphere/cubemap").
- The earlier slice UAT (`90b66f7`, NOW.md:632) passed "does it read as a landscape with a history" — but again on the
  **flat 2D harness**, judged as an **A/B** (epoch-2 off = uncut, epoch-2 on = carved; NOW.md:620–621).

WS4's UAT, by contrast, FAILED on a **single sphere planet** reading as "a tectonic history." These are not the same
gate. "Distinct body types on a flat DEM" and "this one sphere reads as carved tectonic relief in A/B" do **not**
establish "a whole sphere planet reads as a tectonic history to Max." The recommendation treats the slice pass as
transitive evidence for the Option-A sphere UAT; it is **suggestive, not transitive.** The flat→sphere generalization is
the one un-validated step (the recommendation admits this once, §6 Option A cons, then drops it from the confidence
calculus in §7).

---

## 4. Would Max's UAT pass Option A? — judged against the RIGHT bar

This is the lens's central question, and the answer turns entirely on **which bar Option A is judged against.**

- **Against the full story-engine vision (spine §0 + intent.md:13 "continental shapes"):** Option A alone would likely
  NOT fully pass — its baked height has no plate/continent/craton structure; the macro-shape is class-keyed noise blobs.
  A skeptical Max who walks an Earth-like world and looks for "the major continental shapes" will not find them in
  Option A. That is the Option-C gap, correctly flagged but under-weighted in the headline.

- **Against WS4's ACTUAL scoped bar (intent.md:15–16 + the contract's `landscape-with-history` AC):** the AC reads *"the
  relief reads as the coherent result of the forces that formed it (landforms belong to a tectonic system, not random
  scatter) AND drainage has cut into that relief — a clear step toward 'you can see the forces that formed it'"*
  (`contract.json:101`). Continental shapes are **explicitly OUT** of this bar (intent.md:16: "comes from engines NOT in
  this campaign … explicitly later work"). Against THIS bar, Option A is materially likely to pass where WS4 failed —
  because the failure Max named was precisely "relief is synthesized, not data," and Option A makes it data (built +
  carved + sampled), which is exactly what the slice's A/B already demonstrated reads as "carved relief with a history."

**So the recommendation is RIGHT that Option A is the move — but it should be sold against the WS4 scoped bar, not the
full vision.** The recommendation's own §8 says "WS4 is where the FULL 'planet reads as a landscape with a history' UAT
lands" (echoing NOW.md:604) — that overstates WS4's scope vs intent.md:15–16, and it sets Option A up to be judged
against a bar its own intent doc deferred. **This is a real risk of a SECOND UAT framing-mismatch:** if Option A ships
and Max judges it against "where are Earth's continents," it could fail for a reason intent.md already declared
out-of-scope. The fix is framing, not architecture: state up front that Option A closes the *channel* fault Max named
(synthesized→data) and the *WS4-scoped* bar (coherent grain + carved drainage as data), and that continental
macro-structure is the deferred E6-scope/Option-C work.

---

## 5. Where the recommendation is SOLID under the vision lens (the refutation attempts that failed)

- **"Option A just moves noise to a new layer" — FALSE.** Persisted-then-carved height sampled by the renderer is a
  different data path from in-shader synthesis on the one axis Max's UAT named. §2 above, code-confirmed.
- **"Option B could still reach the bar with more tuning" — FALSE, and the vision lens AGREES with the recommendation
  here.** The grain is `stressAtLat(latDeg, drivers)` — a **pure function of latitude** (`src/worldengine/base/
  tectonic.js:19`; the file's own comment, `:50–51`: *"regime/grain are a pure function of latitude … longitudinally
  uniform"*). A latitude-only director cannot encode longitudinal structure, and an in-shader field cannot persist a
  carved drainage network. Iterating B re-decides structure in the shader — the exact inversion spine §0 forbids
  ("procgen decides, render expresses"). Ruling out B is vision-faithful.
- **"The locks are wrong" — FALSE.** Shared mutable substrate, host-editor/epoch, expose+derive, type→label are the
  data-flow discipline the vision requires; nothing in the code or the vision texts contradicts them. The lens confirms
  the recommendation's HOLD on the four headline locks.
- **Decision #6 reopen is correctly identified as the one lock the evidence indicts.** Vision-faithful: #6 ("augment,
  not replace") locked the renderer to express ORIENTATION-only, which is structurally the orientation-overlay Max
  rejected. Reopening it to "which CHANNEL does the renderer express" is the right scope correction.

---

## 6. Missed considerations (things the recommendation should have surfaced and did not, or under-weighted)

1. **The slice's macro-structure is composition-class-keyed, so Option A risks "same-class worlds look the same."** The
   `thicknessBlob` layout is byte-identical within a composition class (`baseStep.js:68–73`). Two rocky worlds, or lava
   ≡ magma, get the SAME continental-blob layout (amplitude/grain differ, layout doesn't). If Option A bakes this height
   as-is, a player visiting two rocky worlds may see the same coarse landmass arrangement — a *new* "reads wrong"
   failure mode the recommendation never names. The authors flagged it (`baseStep.js:72–73`: "If WS4 needs same-class
   worlds to have distinct thickness layouts, fold more identity into the seed") but the ASSESSMENT does not carry it
   into Option A's cons. This belongs in the open questions for Max.

2. **The slice/WS2 height is FLAT-DEM; the sphere bake is the only un-validated generalization, and it is exactly where
   the WS4 UAT lives.** The recommendation's confidence ("Feasibility: High") rests on FastFlow/WebGPU/Liao research,
   which de-risks the ALGORITHM (routing on a sphere) but NOT the AESTHETIC (does class-keyed-noise-blobs + carved
   drainage, wrapped on a sphere, read as tectonic history to Max). The slice UAT was flat; the WS4 UAT is sphere. The
   one thing that has never been UAT'd is the thing Option A must clear. The recommendation should rate the *UAT* risk
   (as opposed to the engineering risk) as Medium, not bury it.

3. **"Structure as data" has a depth gradient the recommendation flattens.** There is a real spectrum: (a) in-shader
   synthesized [WS4 — fails], (b) baked oriented-noise + class blobs, carved [Option A — passes the channel test], (c)
   baked plate/boundary/craton fields, relief derived from them [Cortial 2019 / Option C — passes the vision test]. The
   recommendation treats the line as binary ("either a sampled field or the shader invents it," §7) and puts Option A on
   the right side of a binary. The vision lens says it is a gradient, Option A is the MIDDLE of it, and Max's
   intent.md:13 bar lives at (c) for Earth-like worlds. Option A is the right NEXT rung; calling it "matches the vision"
   (§1) flattens three rungs into two.

4. **The grain itself is vision-INERT for macro-structure even in Option A.** Option A keeps the grain cube to "orient
   the detail residual." But the grain is latitude-only — so on an Earth-like world it produces latitudinal banding of
   detail, not the longitudinally-varying orogenic belts intent.md:13 names ("mountain ranges" as discrete features). The
   recommendation positions the grain as a solved/retained component; the vision lens notes the grain remains the
   *weakest* link for macro-structure and that Option C (or a longitudinal grain source) is needed before "mountain
   ranges" as readable features exist. (The ASSESSMENT does say this in §5/§9, but pairs it with "keep the grain cube
   where it belongs," which reads as endorsement rather than as a flagged limitation.)

---

## 7. Bottom line for the structured verdict

- **refuted: false.** The recommended DIRECTION (Option A now, hold C, drop B) is vision-faithful: it closes the exact
  channel fault Max's UAT named (synthesized→data), it is the right next rung on the structure-as-data gradient, and the
  vision lens independently confirms the rule-out of B (latitude-only grain + in-shader synthesis cannot carry
  macro-structure or a persisted drainage network).
- **The recommendation is over-sold, not wrong.** Two framing weaknesses (headline "honors the vision" / "matches the
  vision" flattens a 3-rung gradient; the slice UAT pass is treated as transitive evidence for a sphere UAT it does not
  establish) and four missed/under-weighted considerations (class-keyed macro-structure repetition; sphere-aesthetic UAT
  risk distinct from engineering risk; the structure-as-data depth gradient; the grain's residual macro-inertness) mean
  the recommendation should be ADOPTED **with its bar re-stated**: Option A clears the WS4-scoped bar (coherent
  built+carved relief as data), NOT the full-vision bar (Earth's continents), which intent.md:15–16 already deferred to
  Option C / later engines. Sold that way, the second-UAT-failure risk the recommendation worries about for Option B
  applies, in a milder form, to Option A too — via bar-mismatch, not mechanism. That is the one thing to fix before
  build.
