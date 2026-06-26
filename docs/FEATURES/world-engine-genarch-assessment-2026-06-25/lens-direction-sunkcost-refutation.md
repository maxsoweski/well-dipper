# DIRECTION / SUNK-COST refutation lens — stress-test of the consolidated recommendation

**Date:** 2026-06-25 · **Branch:** `feature/world-engine-production-L1` · **READ-ONLY** (no code edited).
**Lens:** Try to REFUTE the recommendation by asking — is it over-committing to the locked relief-substrate
direction *because it is already built + UAT-passed*, rather than because it is *right*? Could WS4's
shader-grain have been a sound feasibility hedge? Is there a simpler answer than porting a heavy CPU
substrate? Does any locked decision deserve reopening that the synthesis waved through? Default: skeptical.

**Method:** every load-bearing code claim in `ASSESSMENT.md` was re-verified first-hand against source.
Where the assessment is right, I say so plainly; the weaknesses below are the places the skeptical read bites.

---

## Verdict: NOT REFUTED, but materially weakened on three counts

The recommendation's CORE technical claim survives the skeptical read intact and is **not** a sunk-cost
artifact:

- **The data-vs-shader boundary facts are real, verified, and damning for Option B.** WS4's height genuinely
  stays in-shader noise: `planet-lod-height.glsl.js:949–950` mixes the baked grain in ONLY as a strike *axis*
  that stretches the noise sampling domain (`fbmdRidged`), and `:972` keeps the relief `noised()`-derived. The
  grain's strike is a pure function of latitude by construction (`tectonic.js:19–33 stressAtLat`,
  `:53–63 writeGrainSphere` — the only sphere-native writer, and it writes grain/regime/mag, NOT height). A
  fragment shader reading a latitude-banded compass field cannot synthesize plate-shaped macro-structure or a
  dendritic drainage network. **Option B is correctly ruled out.** That part is not over-committed; it is
  forced by the code.
- **The slice IS a real structure-as-data instance at the data-structure level.** E6 writes
  `substrate.height[i] += …` (`relief-e6-tectonic.js:122`), E9 carves `substrate.height[i] -= dz`
  (`relief-e9-hydrology.js:139`) into the SAME array, and the renderer displaces straight from it
  (`world-engine-relief-lab.main.js:55`). The host-editor / shared-substrate / epoch locks are faithfully
  implemented. No fabrication there.

So the recommendation is **directionally sound** and "do A, hold C, kill B" is a defensible call. BUT the
skeptical read exposes three weaknesses the synthesis waved through — two of which the synthesis itself
*half-acknowledges* and then discounts. Each makes "Option A is the minimum change" and "the four locks are
all corroborated" weaker than the document presents them.

---

## Weakness 1 — "Minimum change / one-channel decision / Medium effort" is materially understated. The sphere height+carve port is NET-NEW, not a re-wiring.

The recommendation's central selling point is that Option A "reuses machinery that already exists … this is a
**one-channel decision, not a re-architecture**" (ASSESSMENT §1, §4, §7) and is **Medium** effort. The code
does not support that framing.

- **There is NO sphere-native height bake anywhere in the repo.** The production `runE6` (`tectonic.js:98–124`)
  writes height on a **flat 2D regular grid** (`iy*n+ix`, `latDegOfRow`, 8-neighbour `jacobiSmooth`) — byte-for-byte
  the slice's flat algorithm. The only thing ported to the sphere is `writeGrainSphere` (`:53`), which writes
  grain/regime/mag and explicitly NOT height. So "bake the substrate's `height` sphere-native" means writing a
  **new** `runE6`-on-sphere (steered noise over the irregular `buildIrregularSphere` mesh with per-node tangent
  frames from `sphereField.tangentFrameAt`, not a grid) — the steered-noise kernel assumes a regular grid and a
  global `(x,y)` domain it does not have on an icosphere.
- **E9 has the same problem, and is worse.** E9 is flat-only (`relief-e9-hydrology.js`: regular-grid priority-flood,
  D8 steepest-descent over `NEI` grid offsets, Kahn accumulation over a grid). The sphere uses an irregular
  adjacency graph. ASSESSMENT §6 itself admits "E9 isn't yet ported to B (only A has hydrology)" — then waves it
  away with "via the existing router or a port." The existing sphere river router (`planet-lod-rivers.js`) routes
  *rivers as cosmetic channels*; it is NOT a priority-flood + stream-power *incision-into-a-height-array* engine.
  Reusing it to actually subtract from a baked sphere height is itself an unproven generalization.
- **Net:** Option A is **two engine re-implementations onto a different topology** (sphere `runE6` height + sphere
  E9 carve), plus the bake→texture→sample→displace plumbing, plus the seam/pole correctness work the slice's own
  caveats flag. That is not "one channel." The honest effort is **Medium-High → High**, and the "machinery already
  exists" claim is true only for the *grain* path (the half that already shipped and failed UAT). The recommendation
  borrows the low risk of the validated grain path to price the un-validated height path. That is exactly the
  shape of a sunk-cost-flavoured estimate.

This does not refute "do A" — but it refutes the *framing* that makes A look obviously cheaper than re-scoping.
If A is really High effort, the gap between A and the dismissed-as-too-big Option C narrows, and a cheaper
middle path (Weakness 3) deserved a fair hearing it did not get.

## Weakness 2 — The slice's UAT pass is being used to corroborate a DIFFERENT claim than it actually tested. The slice has the SAME "presets just change amplitude" defect WS4 was failed for.

The recommendation leans hard on "the four locks are corroborated by the slice's UAT pass AND every production
renderer surveyed; none should be revisited" (ASSESSMENT §1, §9-HOLD). The skeptical read finds the slice's own
build-intent docs directly undercutting how that pass is being deployed:

- `relief-presets.js:14–19` (the slice's OWN words): *"Presets currently modulate **AMPLITUDE/INTENSITY only** …
  They do NOT … change formation SHAPE. Spatial pattern is **SEED-LOCKED & preset-independent** … the tectonic
  grain bands are **latitude-only** (Melosh despin). Same seed + different preset = **IDENTICAL landform layout,
  only rescaled in height**. (This is exactly the 'presets just change amplitude' UAT observation, 2026-06-23.)"*
- `relief-slice.js:21–26` lists as a deliberate non-goal: "palette stays height-only," "precip stays
  latitude-only," and the layout is latitude-banded.
- The macro-structure that *is* body-varying comes from `thicknessBlob` — **two octaves of seeded simplex**
  (`relief-base-step.js:79–84`), and in the production port `baseStep.js:68–73` documents that the thickness field
  is **byte-identical across same-class worlds** (lava ≡ magma, rocky ≡ terrestrial).

So what did the slice's UAT actually pass on? Per the INDEX: the divergence gate is **regime | hydrology | carve**
(`relief-slice.js:58–88`) — i.e. "the three bodies read as *categorically distinct*" (THRUST vs NORMAL banding,
carve-vs-no-carve). That is a real and worthwhile result. But it is **not** the same criterion WS4 was failed on.
WS4's UAT bar (its `intent.md`) is *"looking at the planet as a whole you can see the results of the forces that
formed it — continental shapes, ranges, plateaus, plains"* — **structure / layout**, not amplitude or
categorical divergence. The slice **explicitly disclaims** producing distinct *layout*; its relief layout is
latitude-banded steered noise plus a noise blob, the very thing ("orientation overlay / banded") that WS4 was
failed for.

**The bite:** the document treats "the slice passed UAT" as proof the locked architecture *reaches the WS4 bar*.
It does not. The slice passed a *different, narrower* UAT (categorical divergence on a flat DEM), while carrying
the same structural limitation (latitude-banded, amplitude-keyed layout) that sank WS4. Porting that exact
height field to the sphere (Option A) would deliver a planet whose macro-layout is **latitude bands + a
low-freq simplex blob + drainage**. That can plausibly read better than WS4's pure-shader version (because the
drainage genuinely cuts real baked relief, and the displacement is a sampled field) — but the recommendation has
**no evidence** that this clears the *structure* bar Max named, and it is over-stating the slice pass to imply it
does. This is the single largest sunk-cost tell in the document: the validated artifact is being credited for a
property it was explicitly built NOT to have.

## Weakness 3 — A cheaper middle path (bake a coarse low-frequency ELEVATION province, not a full E6+E9 sphere substrate) is dismissed as "Option B" without being evaluated on its merits.

The document collapses the option space into a false trichotomy: A (full height substrate port) / B (keep
iterating the *current* shader grain) / C (A + plates). It never considers the obvious intermediate that the
prior-art it cites actually describes:

- Cordonnier 2016 / clipmaps / Outerra (per the research files) all bake a **coarse low-frequency structural
  field** and use shader noise as a *residual on top*. The decisive property is "a baked field commits the
  low/mid-frequency SHAPE," NOT "the entire height array including detail is baked." A and B are the two extremes;
  the field-standard pattern is the middle.
- The repo already has the consumer for this: `gProvince` / `initProvinces` / `provinceWeight`
  (`planet-lod-height.glsl.js:824–848`) is an in-shader low-frequency region machinery that every combiner already
  multiplies against. Decision #6 chose to *augment* it with orientation. A genuinely *smaller-than-A* option is:
  **bake a coarse per-body elevation/amplitude province FIELD from the substrate** (a low-resolution height or
  province cube — the same cube-bake machinery WS4 already built for the grain, `planet-lod-tectonic.js`) and feed
  it as a low-frequency displacement/amplitude bias the shader reads, while detail stays `noised()` on top. This
  commits the *macro shape* to data (the north-star property) without re-implementing E9 incision on the sphere and
  without a full per-texel height sample.
- This is NOT the same as "Option B / keep iterating the grain" — B was correctly killed because *orientation*
  cannot carry structure. A baked low-freq *elevation* field is structure-as-data; it is a different channel than
  the grain. The document conflates "iterate the grain" (dead) with "bake a coarse field short of a full substrate"
  (live and cheaper than A), and so never prices the cheapest path that satisfies the criterion.

The recommendation may still land on full-A after evaluating this — full height + real carve is higher fidelity.
But presenting A as "the minimum change that moves the criterion" while never costing the coarse-province middle
path is an over-commitment to the heaviest validated artifact. The minimum change is almost certainly smaller
than A.

---

## Was WS4's shader-grain a sound feasibility hedge? — Partly yes; the document is unfair to it.

The skeptical read finds WS4 more defensible than the document's "wrong channel / failed" framing:

- WS4 was **built exactly to its locked spec.** Decision #6 (`world-engine-production-L1-plan.md:264`) said
  "augment, not replace." WS4's `verdict.json` AC `renderer-expression-only` PASSED by confirming it did NOT touch
  `gProvince`. It was a deliberately *low-blast-radius, reversible* increment (`uTectonicGrainStrength==0` →
  byte-identical fallback, `planet-lod-height.glsl.js:947–951`). As a feasibility hedge — "prove one shared field
  can drive six consumers seam-free on the sphere before committing to a full bake" — it **succeeded** (the
  `one-shared-grain` AC, cosToShared=1.000, proves the cube-bake + sphere-sample + seam-free plumbing works). That
  plumbing is the SAME plumbing Option A needs. So WS4 de-risked the *delivery mechanism* for A; it was not wasted.
- The document is also unfair in claiming WS4's `intent.md` "names Earth's continents as part of the bar"
  (ASSESSMENT §1, §9-FLAG, openQuestions #2). The intent.md says the **opposite**: under "Scope honesty — WS4 is a
  milestone toward that bar, not the whole bar," it explicitly defers continental shapes / Sputnik-Planitia to
  *engines not in this campaign (E7/E8/E11)* and states "WS4's UAT judges the grain+drainage read as a coherent
  step, not the finished planet." The §9 E6-plate-scope FLAG partly rests on a misreading of the intent doc. The
  underlying point (Melosh produces bands, not plates) is still true — but it is the assessor's framing, not (as
  claimed) something Max's own WS4 bar demands.

What WS4 was NOT is a *failure of the architecture*. The UAT failed because the increment, by design, left the
relief body in shader noise. That is a fair finding. But "sound feasibility hedge that proved the delivery path
and was correctly scoped small" is a more accurate description than the document's "wrong channel on one surface."

---

## Does any locked decision the synthesis waved through deserve reopening?

- **Decision #6 — the document already flags REVISIT. Concur, and it is the right call** (it was the *cause* of the
  WS4 result). No quarrel.
- **The four headline locks — the document says HOLD; the skeptical read says HOLD on three, QUALIFY the fourth.**
  The shared-mutable-substrate (§2), host-editor/epoch, and Option-A-expose+derive locks are sound and corroborated
  at the *mechanism* level. But the lock the synthesis should NOT have waved through as fully corroborated is the
  implicit assumption that **a despun-shell/zonal-stress E6 + simplex thickness blob is an adequate BUILD engine**.
  Both the slice and the production base step produce **latitude-banded, amplitude-keyed, same-class-byte-identical**
  layout by their own admission. The architecture (substrate + host-editor) is right; the *content the current
  BUILD engine writes into it* is the unsolved problem, and porting it to the sphere does not solve it — it relocates
  it. The document's §9 E6-FLAG gestures at this but files it as "mid-confidence, not blocking for A." The skeptical
  read promotes it: it is the crux, not a footnote, because Option A's payoff is gated on whether the *content* of
  the baked height clears Max's structure bar — and the evidence (slice non-goals) says today it does not.

---

## Minor / corroborating

- **D12 hard-zero line:** the document corrects the cite to `PlanetGenerator.js:613`. Verified the actual literal
  `0` passed to `computeSurfaceHistory` is at `:606–611` (the call spans :606–613). The correction is in the right
  region; ":613" points at the close of the call, ":606" at its head. Either way the brief's old ":565" is wrong;
  the document's instinct is right, the exact line is ~606.
- **"E9/hydrology = exactly 1 copy (A only), no dead code"** — verified; `runE9` exists only in
  `relief-e9-hydrology.js`. The production base (B) has no hydrology. This reinforces Weakness 1: A's carve path is
  genuinely unbuilt for production.
- **River router sphere-native** — verified (`buildIrregularSphere`, `planet-lod-rivers.js:246`, used by both the
  router and the grain baker). True, but it is a *channel renderer*, not an incision engine (Weakness 1).

---

## Bottom line for Max

The recommendation is **not refuted** — "do A, hold C, kill B" is directionally correct and B is genuinely dead.
But before greenlighting Option A as scoped, three corrections matter:

1. **Re-price A as Medium-High/High, not Medium.** It is two engine re-implementations onto the sphere
   (height + carve), not a one-channel re-wire. The "machinery already exists" claim covers only the grain path.
2. **Do not assume A clears the WS4 bar.** The slice's UAT pass was on *categorical divergence*, while the slice
   *explicitly disclaims* producing distinct macro-LAYOUT — the exact property WS4 was failed for. A ports a
   latitude-banded + simplex-blob layout to the sphere. It will likely read *better* (real carved relief, sampled
   displacement) but there is no evidence it reads as *structure*. Treat A as another step toward the bar, gated by
   Max UAT — not as the fix that closes it.
3. **Evaluate the coarse-elevation-province middle path before committing to full A.** Baking a low-frequency
   elevation/amplitude field (reusing WS4's existing cube-bake) and keeping detail as an in-shader residual is the
   field-standard pattern the research itself describes, is cheaper than a full sphere E6+E9 substrate, and — unlike
   the (correctly-killed) grain iteration — *is* structure-as-data. The document's A/B/C trichotomy omits it.

The deepest issue the synthesis under-weights: **the architecture is right but the current BUILD engine's
output is the unsolved problem.** The relief substrate is a good box; what E6 writes into it today is
latitude-banded amplitude-keyed noise. Option A moves that box to the sphere. Whether the *contents* satisfy
"you can see the forces that formed it" is the open question — and it points at the E6-scope flag (a real BUILD
engine: one-pass plate placement, or richer structural fields) being closer to the crux than Option A's plumbing.
