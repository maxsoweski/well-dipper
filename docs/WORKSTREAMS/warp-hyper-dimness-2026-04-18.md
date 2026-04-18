# Workstream: Warp HYPER tunnel dimness — find the lab↔production delta (2026-04-18)

## Parent feature
`docs/FEATURES/warp.md` — specifically §"Phase-level criteria (V1) HYPER":
*"tunnel geometry is cylindrical and extends into distance. Starfield
tunnel (not sphere interior). Destination visible at the far end at some
point during HYPER."* Today production HYPER fails the second and third
of those: the tunnel reads as mostly-black with six sparse streaks
(`screenshots/tunnel-brightness-prod-sol-2026-04-18.png`), so there is no
visible starfield and no visibility through to a destination. Also
advances the §"Current state snapshot (2026-04-18)" line for HYPER —
moves it from *"first half works, second half broken"* (pre-`10642b2`)
through *"first half works, second half exists but dim"* (post-`a1ff634`)
toward *"first half works, second half is a visible, moving star
tunnel."*

## Implementation plan
`docs/PLAN_warp-tunnel-v2.md` — steps 6 and 8 (procedural starfield in
`WarpPortal.js` + `WarpEffect`→`WarpPortal` wiring) are the surface this
brief investigates. **No new PLAN steps proposed.** If the bug is
shader-layer the fix modifies one shader; if pipeline-layer the fix
modifies the plumbing between `main.js` and `WarpPortal`. Neither is a
PLAN-level architectural change.

## Scope statement

Find and close the single remaining delta between `starfield-cylinder-lab.html`
(isolated lab, reads as a bright continuous starfield tunnel) and
production HYPER (reads as a mostly-black frame with ~six sparse streaks)
despite both being driven by the same shader code from
`src/effects/WarpPortal.js` and — per the `a1ff634` commit body —
*identical shader inputs*. One unit of work because the investigation, the
fix, and the verification all pivot off a single controlled comparison:
lab output vs. production output at matched seeds, matched
camera-to-wall distance, matched scroll phase. The answer to "where does
the delta come from?" is the thing being shipped; the fix itself is
either a shader edit or a pipeline edit, and which side of that fork
depends on what the controlled comparison shows. Do not edit
`WarpPortal.js` before the fork is decided.

## How it fits the bigger picture

Advances `docs/FEATURES/warp.md` §"Phase-level criteria (V1) HYPER" by
taking the tunnel from *technically-passing-AC-#4* (stars exist, animate,
differ per seed) to *visually-correct* (tunnel interior reads as a
starfield extending into the distance). AC #4 of the sibling brief was
written as a minimum guardrail — "not identical frames" — and a dim,
sparse tunnel can pass that bar while still failing the Bible-level spec.
This brief closes that gap.

Advances `docs/GAME_BIBLE.md` §"The Warp as Sacred Experience." Six
sparse streaks in a near-black tube is the antithesis of sacred — it
reads as a bug, not a passage. The whole §1A Layer 1 Screensaver
inventory claim *"Warp transitions with fold/hyperspace/exit animations"*
is only honestly true when the tunnel visibly **is** a tunnel of stars,
not merely contains a few.

Advances `docs/GAME_BIBLE.md` §1 Vision by unblocking honest evaluation
of every remaining HYPER question. §"Open questions" in the feature doc
asks *"Destination-star-visible timing: at what fraction through HYPER
should the destination star first become visible?"* That question is
currently unanswerable — not because of a timing bug but because the
tunnel is too dim to see through. Fix the dimness and the destination-
visibility question becomes a tuning decision rather than a structural
one. Same unblocking applies to the feature doc's §"Failure criteria"
items — *"stuff popping in/out,"* *"tunnel visible from the side"* —
which can't be visually audited against the current dim output.

Finally: this brief is the Director's **pick over three alternatives**
(ENTER freeze, Freeze 2, EXIT forensics) for this session, on structural
grounds. The Director's reasoning, load-bearing for why dimness and not
something else, is summarized at the top of the Drift risks section so
future sessions don't re-litigate.

## Acceptance criteria

1. **Controlled comparison captured before any `WarpPortal.js` edit.**
   `starfield-cylinder-lab.html` is driven with the same origin seed,
   destination seed, tunnel radius, and camera-to-wall distance that
   production delivers at mid-HYPER. Capture a screenshot of each and
   place them side-by-side in the commit body. Exactly one of two
   outcomes:
   - **Lab matches production dimness under matched inputs** → bug is
     in the shader path — proceed to shader edit.
   - **Lab remains bright under matched inputs** → bug is in the
     pipeline — production is not delivering the inputs the runtime is
     claimed to deliver. Proceed to pipeline investigation
     (camera pose post-teleport, tunnel radius at ship-scale, seed
     origin, scroll initial phase, whatever).

   Evidence: two PNGs in `screenshots/` named
   `tunnel-dimness-lab-matched-2026-04-18.png` and
   `tunnel-dimness-prod-matched-2026-04-18.png`. The commit body
   states which fork the delta falls on, with one-sentence justification
   pointing at the specific input that differs (or doesn't).

2. **Real-flow filmstrip, not `_warpEffect.start()`.** Per
   `feedback_test-actual-user-flow.md` and reinforced in the sibling
   brief's Drift Risk #4. Real click on a destination star, real Space×3
   through the commit sequence, Chrome on port 9223 post-Vite restart,
   `~/.claude/helpers/filmstrip.js` at `fps:30, maxFrames:450`. Synthetic
   `window._warpEffect.start()` entries skip the state machine between
   `beginWarpTurn()` and the swap callback that this very workstream
   investigates — verification via that path would be invalid by
   construction.

3. **Side-by-side visual comparison in the close-out commit.** Lab
   filmstrip and production filmstrip both captured at the same
   origin→destination seed pair, at the same camera-to-wall distance, at
   the same scroll phase (easiest: reset `uScroll` to 0 in both at the
   frame chosen). Inline both images in the commit body. "Looks brighter
   now" without the matched comparison does not close AC #3 — that's
   vibe testing, and the sibling brief's history includes three
   prior patch attempts that each felt like progress.

4. **Sol and procedural both tested.** Per `feedback_always-test-sol.md`:
   Sol hits `KnownSystems` / `SolarSystemData` — a distinct code path
   that has regressed invisibly before. Real-click-Space×3 filmstrips
   captured for a procedural destination AND for Sol as destination;
   both must show the same brightness behavior post-fix. If Sol differs
   from procedural, that's its own bug — log it as a followup, do not
   bundle.

5. **EXIT forensics finding appended.** While capturing the real-flow
   filmstrips for ACs #2–#4, the EXIT frames are on the contact sheet
   anyway. Read-only pass: does the current production code still render
   a functional EXIT (crowning transition per §Phase sequence EXIT), or
   was it reverted during the 2026-04-13→14 patch-thrash? One paragraph
   recorded in this brief's close-out section *and* pasted into
   `docs/FEATURES/warp.md` §"Current state snapshot (2026-04-18)" as a
   PM-proposed diff for Director to merge. **This is forensics only.**
   If EXIT is broken, spin a separate workstream — do not fix it here.

6. **One commit for the dimness fix.** Commit message shape:
   `fix(warp): [shader|pipeline] — [specific-input] — restore tunnel
   brightness`. Commit body includes the matched lab↔prod comparison
   (AC #1) and the matched filmstrips (AC #3). If during iteration the
   streak-length, blue/red shift, or density-tuning temptations appear,
   log them as followup workstream candidates in this brief's close-out
   section — do not land them in this commit. Sibling brief shipped two
   commits and kept them clean; this one ships one.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy. Four principles
are load-bearing here; the other two — Principle 1 Simulation-First and
Principle 4 whichever — are not relevant to this work and are
intentionally omitted.)

- **Principle 6 — First Principles Over Patches.** The `a1ff634` commit
  body has already identified the diagnostic fork: lab and production
  have *identical shader inputs* yet produce visibly different output.
  That's a contradiction, which means one of the two halves is wrong
  about its inputs. The principled move is to find which input is
  actually different and fix at the source of the divergence. The
  patch-move is to "just brighten it" — add an exposure knob, bump a
  multiplier constant, raise `uScroll` rate, double the star count. Each
  of those would hide the divergence without resolving it, and would
  leave the lab vs. production mismatch in place for whoever inherits
  the system next. **If the lab turns out to reproduce the dimness under
  matched inputs, the shader *is* the bug and a targeted edit is
  principled.** If the lab stays bright under matched inputs, the
  pipeline is the bug and the shader edit would be cosmetic cover-up.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer Consumes.**
  The most likely pipeline-side divergences sit exactly along this
  axis: the Model layer (galactic star seeds, `HashGridStarfield`) may
  be producing different seed values than `WarpPortal` is actually
  receiving at HYPER time, OR the camera pose / tunnel radius / scroll
  initial phase that the Pipeline hands to the Renderer at HYPER-start
  may not match what the lab hardcodes. Investigation must trace
  Model → Pipeline → Renderer in that order for each input. Inventing
  inputs at the Renderer to compensate (e.g., re-randomizing the seed
  in the shader if it looks too quiet) is the exact Principle 5
  violation the sibling brief already called out.

- **Principle 3 — Per-Object Retro Aesthetic.** Whatever the fork
  decides, the fix lives inside the tunnel's own object — either its
  fragment shader, its uniform-feed code, or the pipeline that populates
  its uniforms. No screen-space filters, no post-process exposure pass,
  no fullscreen brightness tonemap "for HYPER frames only." The tunnel
  is an object; its aesthetic is its own.

- **Principle 2 — No Tack-On Systems.** Adding a `uBrightness` uniform
  or a `uDimnessCompensator` hack would be a new tack-on surface — a
  knob that exists only because we didn't figure out why the existing
  inputs diverged. If the existing uniform surface
  (`uScroll`/`uHashSeed`/`uDestHashSeed`, plus the tunnel mesh's
  geometry parameters) can't be made to produce the correct output with
  correct inputs, the right move is to understand why before adding
  knobs.

## Drift risks

The sibling brief noted that the patch-loop history for this area is
long enough to warrant explicit listing. That history continues here —
this brief inherits risks #1 and #4 from the sibling (which is why it
restates some of them) and adds new ones specific to the dimness
investigation.

Before the risk list: **the Director's argument for why this is the
right workstream to open today**, load-bearing context so the drift
risks below make sense in their Director-voice framing.

> Look at `screenshots/tunnel-brightness-prod-sol-2026-04-18.png`. AC #4
> of the sibling brief passes (stars exist, animate, differ per seed)
> but the tunnel reads as a mostly-black frame with ~six sparse streaks.
> Technically-passing, visually-wrong. Not "tunnel interior made of
> stars" per the feature doc's §HYPER criterion. The dimness fix is
> shader-layer or pipeline-layer — not structural — tightly scoped,
> uniform-wiring-only. Isolated lab `starfield-cylinder-lab.html`
> already exists. No refactor risk. Dimness unblocks honest evaluation
> of every other HYPER problem — today we can't judge "destination
> visible during HYPER?" because the whole tunnel is too dark to see
> through, and that question is literally flagged in
> `docs/FEATURES/warp.md` §"Open questions." Not ENTER, because the
> feature doc calls that fix "load-timing, not shader" — structural
> workstream, wrong moment right after patch-loop recovery. Not
> Freeze 2, because it touches the same `spawnSystem` that ENTER-freeze
> work will restructure; sequence Freeze 2 *with* ENTER. Not EXIT
> alone, because forensics-only ships nothing — fold EXIT forensics
> into this session's filmstrips opportunistically (the frames get
> captured anyway).

Risks:

- **Risk: Inventing brightness hacks.** This is the dominant risk — it
  is what "patch the feeling, skip the reasoning" looks like in this
  area. Tempting moves include: adding a post-process exposure pass
  (Principle 3 violation), adding a brightness-multiplier uniform
  (Principle 2 violation), tweaking `pixelScale` or `fogDensity`
  (Principle 6 violation — would hide the divergence, not resolve it),
  hardcoding a brighter default for `uHashSeed` (Principle 5 violation —
  wrong layer). Working-Claude's own `a1ff634` commit body establishes
  that lab and production have *identical shader inputs* yet visibly
  differ. That means the delta is in the **inputs the runtime actually
  delivers**, not the shader's math. Hunt the input divergence.
  **Why it happens:** the tempting hacks are each one-line changes that
  would visibly brighten the screen and feel like a fix. The hack lands,
  the screen looks better, the investigation doesn't happen. The next
  session opens a dimmer-than-lab screen at a different seed and
  re-opens this workstream.
  **Guard:** AC #1 makes the fork decision a *precondition* for any
  `WarpPortal.js` edit. If you find yourself writing shader code before
  the matched-inputs comparison is captured, stop.

- **Risk: Declaring it fixed from a single filmstrip.** A filmstrip that
  "looks brighter than `tunnel-brightness-prod-sol-2026-04-18.png`"
  could mean the fix worked, or could mean you picked a different seed
  and a different camera angle. Without the controlled comparison,
  "looks brighter" is vibe-testing.
  **Why it happens:** the sibling brief's commit body included three
  back-to-back filmstrips and they all looked noticeably different from
  each other. Seed variation produces real visual variation. A naive
  post-fix filmstrip vs. a naive pre-fix filmstrip will look different
  whether or not the fix is correct.
  **Guard:** AC #3 requires the same origin→destination seed pair in
  both lab and production filmstrips, same camera-to-wall distance,
  same scroll phase. "Controlled" means if the only change between two
  images is the fix, the difference is the fix.

- **Risk: Touching `WarpPortal.js` before the lab reproduces the delta.**
  If the lab matches production dimness when fed production's actual
  runtime inputs (seeds + tunnel-radius + camera-distance + scroll
  phase), the bug is in the shader and a shader edit is principled. If
  the lab stays bright under those inputs, the bug is in the pipeline
  (most likely: the camera isn't where we think it is relative to
  tunnel walls post-teleport, or the tunnel radius is wrong at ship-
  scale, or the seed values that `main.js:4346-4347` claims to pass are
  not what `WarpPortal` actually sees at HYPER frame-start). **Do not
  edit the shader until the lab tells you which side of that fork the
  bug is on.**
  **Why it happens:** the shader is the visible surface. "Make the
  visible surface brighter" is the obvious intervention. The diagnostic
  step of populating the lab with production's actual runtime inputs
  takes work (printing the values at HYPER-start, copying them into the
  lab's defaults, re-rendering).
  **Guard:** AC #1 is the gate. The commit message's
  `[shader|pipeline]` tag forces the author to commit in writing to
  which fork the delta lives on.

- **Risk: Scope-creep into HYPER "second half" quality.** The sibling
  brief's orphan fix made the HYPER second half *exist*; it is not yet
  *good*. Dimness is one axis of not-good. Streak length, streak
  density, relativistic blue/red shift, and destination-star far-end
  visibility are other axes. Each is tempting to fold in once you are
  already in the shader.
  **Why it happens:** "while we're editing `WarpPortal.js`" is one of
  the three classic scope-creep formulations. The sibling brief's
  Drift Risk #2 about not re-attempting Freeze 2 in the same commit
  is the same failure mode in a different dress.
  **Guard:** AC #6 is one commit, one axis. Streak and blue-shift land
  in their own workstreams, in later sessions. List any temptations
  that arise during iteration in this brief's close-out section as
  followup candidates.

- **Risk: Fourth patch attempt on the orphan bug masquerading as a
  dimness fix.** The sibling brief's Drift Risk #1 enumerated three
  prior patch attempts on the HYPER orphan bug — each of which
  visibly produced *something*. If the lab matches production and a
  shader edit happens here, there is a live temptation to
  simultaneously adjust the re-anchor logic "while we're in warp code,"
  claiming it as part of the dimness fix. That is a category error:
  orphan-timing and dimness are separate bugs, the orphan fix has
  already shipped (`10642b2`), and bundling would make bisection
  impossible if HYPER regresses.
  **Why it happens:** both bugs live in the same three files
  (`main.js`, `WarpEffect.js`, `WarpPortal.js`) and the patch-loop
  history of the area warps future sessions into seeing "the warp
  issue" as one thing.
  **Guard:** the close-out commit touches only the path the fork
  decision identified — the shader OR the pipeline's uniform feed,
  NOT the traversal callback, NOT `onTraversal`, NOT `onSwapSystem`,
  NOT portal re-anchor. If the diff surfaces any of those functions,
  stop and escalate.

## In scope

- AC #1 matched-inputs capture: drive `starfield-cylinder-lab.html` with
  production's actual runtime values for the four inputs that plausibly
  differ (origin seed, destination seed, tunnel radius at camera
  position, camera-to-wall distance) and publish the side-by-side.
- AC #2–#4 real-flow filmstrips (Sol + procedural) via click + Space×3
  post-Vite-restart, using `~/.claude/helpers/filmstrip.js`.
- The fork decision and its fix:
  - **Shader fork:** targeted edit in `src/effects/WarpPortal.js`
    `_tunnel.material` fragment shader (currently starting ~line 161,
    `StarLayer`-based composition at lines 241/250). Edit only the
    specific math the lab-vs-prod comparison implicates.
  - **Pipeline fork:** targeted edit in whichever layer between `main.js`
    and `WarpPortal` is passing the divergent input — most commonly
    either the seed source at `main.js:4346-4347`
    (`setOriginSeed`/`setDestinationSeed`), the tunnel radius at
    `WarpPortal` construction, the camera pose feed during HYPER, or
    the initial `uScroll` phase.
- AC #5 EXIT forensics as a read-only pass during filmstrip capture:
  does EXIT still visually render a crowning transition, or is the
  section of the filmstrip after HYPER a cut / black frame / missing?
  One paragraph recorded here + PM-proposed diff to
  `docs/FEATURES/warp.md` §"Current state snapshot (2026-04-18)."
- One commit landing the fix with the matched lab↔prod comparison and
  the matched filmstrips inlined in the body.
- Close-out update to this brief's Status line with the commit SHA,
  plus any followup workstream candidates logged.

## Out of scope

Redirect all of these away from this workstream:

- **ENTER 1–2 s freeze.** Feature doc §"Current state snapshot" lists
  this as *"the primary bug blocking V1"* — but the same feature doc
  §"Critical architectural realizations" identifies it as a **load-
  timing** problem, not a shader problem. That means its workstream
  will restructure `spawnSystem` and destination-asset preload, which
  is a larger structural intervention than this brief wants to
  concurrency-risk. **Director's explicit call this session: dimness
  first, ENTER next (bundled with Freeze 2 since they touch the same
  `spawnSystem` code path).**
- **Freeze 2 (`spawnSystem` preSpawn/activate split).** Reverted in
  `8349e53`. Belongs with ENTER per Director's pick above, not here.
- **Streak length / streak density / relativistic blue-red shift.**
  V-later per `docs/FEATURES/warp.md` §"V-later." Do not bundle, even
  if the fork lands in the shader and the math is right next door.
- **EXIT bugfix.** AC #5 is forensics only. If forensics reveal EXIT is
  broken, spin a new workstream with its own scope; do not fix in this
  commit. The sibling brief made the same call about orphan + Freeze 2
  and it was right.
- **Destination-star-visible timing.** Once dimness is fixed, this
  becomes answerable as a tuning decision. Separate workstream —
  probably belongs with the HYPER→EXIT handoff polish.
- **Bible updates.** `docs/FEATURES/_drafts/GAME_BIBLE_diff_warp.md`
  is still unmerged; Director-owned.
- **SYSTEM_CONTRACTS §Warp authorship.** Director confirmed in session
  2026-04-18 that they will add the §Warp section this session
  separately. PM may draft on request but will not own the promotion.
- **Audio transition shape.** Feature doc §"Open questions" — music
  integration workstream, not this one.
- **Portal B post-warp FP drift.** Blocked on world-origin rebasing per
  `docs/PLAN_world-origin-rebasing.md`.

## SYSTEM_CONTRACTS.md gaps (flag for Director)

`docs/SYSTEM_CONTRACTS.md` still has no §Warp section. The sibling brief
flagged this; the Director confirmed in-session (2026-04-18) it is a
real gap to be filled this session separately. This brief adds one more
invariant that a future §Warp should include:

> **Uniform-input parity invariant.** The starfield-cylinder lab is
> the canonical visual reference for the HYPER tunnel. If a future
> change to the shader, the uniform surface, or the pipeline feeding
> the uniforms causes the production HYPER tunnel to visibly diverge
> from the lab rendering the same inputs, that is a regression — not a
> tuning choice. The lab↔prod comparison is the ground-truth check,
> not "looks fine in production." The divergence this workstream
> chased is an instance of this invariant being violated silently;
> codifying it prevents recurrence.

**Flag for Director:** once the fork is resolved by this workstream,
append this invariant to the §Warp section the Director is drafting.
If the fork resolves to "pipeline was diverging," the specific
divergence (e.g., "tunnel radius at ship-scale does not match
lab default") is itself a sharper invariant the §Warp section should
capture.

## Handoff to working-Claude

Read this brief first. Then `docs/FEATURES/warp.md` §"Phase-level
criteria (V1) HYPER" and §"Current state snapshot (2026-04-18)." Then
`src/effects/WarpPortal.js` around lines 141–165 (uniform declarations),
601–603 (per-frame `uScroll` advance), 622–634 (external setters),
and `src/main.js` around lines 4338–4347 (where `setOriginSeed`/
`setDestinationSeed` are called and what seed source they use) and
447–495 (`onTraversal`/`open` callback wiring). Then
`starfield-cylinder-lab.html` in full — it's the ground-truth lab for
this shader and the fork decision runs through it.

Then, in order:

1. **Capture production's actual runtime inputs at HYPER frame-start.**
   Simplest path: add a `console.log` block at the top of
   `WarpPortal.update()` (or wherever HYPER frames begin being drawn)
   printing the current `uHashSeed.value`, `uDestHashSeed.value`,
   `uScroll.value`, the tunnel's `geometry.parameters`, and the camera's
   world position relative to the tunnel's world position. Do one real
   warp to Sol; capture the log.
2. **Drive the lab with those exact values.** Plug the captured seed
   values, tunnel radius, and camera-to-wall distance into the lab's
   defaults. Screenshot the lab. Save as
   `screenshots/tunnel-dimness-lab-matched-2026-04-18.png`.
3. **Screenshot production at that same runtime moment.** Save as
   `screenshots/tunnel-dimness-prod-matched-2026-04-18.png`.
4. **Decide the fork from the two images.** If they look the same
   (both dim, or both bright), the inputs reaching the shader are
   equivalent — the delta must be in the inputs or in something outside
   the shader's `StarLayer` (e.g., the tunnel's visibility fog, the
   mesh's backface culling relative to the camera's actual position).
   If they look different, the inputs reaching the shader are NOT
   equivalent and the lab defaults contain something production doesn't
   actually get. Trace the non-matching input back to its source.
5. **Land the fix on the fork's side only.** Shader edit OR pipeline
   edit, not both. Minimum diff that makes production match the lab.
6. **Filmstrip real-flow for Sol + procedural (ACs #2–#4).** Note any
   EXIT forensics findings in passing (AC #5).
7. **Commit with the matched comparison and matched filmstrips inlined
   in the body.** Commit message: `fix(warp): [shader|pipeline] —
   [specific-input] — restore tunnel brightness`.
8. **Update this brief's Status line** to `Shipped` with the commit SHA.
   Append EXIT forensics finding to the close-out section and propose
   the `docs/FEATURES/warp.md` §"Current state snapshot" diff. Log any
   polish temptations that came up during iteration (streak length,
   blue-shift, density) as followup workstream candidates.

Artifacts expected at close: two matched-inputs PNGs (lab + prod), two
filmstrip PNGs (Sol real-flow + procedural real-flow), one commit. If
any verification step fails in a way that feels like "just needs one
more tweak," stop and escalate — the patch-loop lesson for this area
from the sibling brief is explicit, and it applies here too.

## Status

Drafted by PM 2026-04-18. Ready for working-Claude execution. Director
audit requested at close.
