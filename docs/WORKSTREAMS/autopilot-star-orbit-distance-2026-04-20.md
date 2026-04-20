# Workstream: Autopilot star approach distance (2026-04-20)

## Status

Scoped — awaiting working-Claude execution.

## Parent feature

**`docs/FEATURES/autopilot.md`** — **§ENTRY** (primary) and **§STATION**
(contrast). Authored by Director at commit `bdeb0ff` (2026-04-20) from
a heart's-desire → V1 interview with Max.

- **§ENTRY criterion — *"Holds safe distance — the ship can't get too
  close to a star/binary. … the post-warp arrival orbit should read as
  'a long respectful look at a stellar body,' not 'skimming the
  photosphere.'"*** The 20× radius-multiplier candidate this brief
  targets is the operationalization of that criterion for stars
  specifically. The feature doc's §V1 / must-ship list names this
  workstream by path under *"Star-orbit safe-distance rule — the
  star-orbit-distance workstream lands against this criterion."*
- **§STATION criterion — *"Tight orbit, immersive — close enough that
  the planet is 'ground' and the starfield is 'sky.'"*** This is the
  ratio-contrast framing: planet STATION is deliberately close
  (immersive-ground); star STATION must be deliberately far
  (respectful-look). The two-recording verification pair (AC #6) is
  the evidence that this contrast reads at the shipped multipliers —
  one recording for each pole.
- **§Failure criteria — *"Star-approach `STATION` skims the
  photosphere — failure of the safe-distance rule. (This is the
  symptom the star-orbit-distance workstream fixes.)"*** The feature
  doc explicitly names this workstream as the fix for that failure
  mode; the ship-gate demo is where Max confirms the fix.

Primary contracts: **`docs/SYSTEM_CONTRACTS.md` §10 Autopilot**
(bootstrapped by Director in the same `bdeb0ff` commit — autopilot's
structural invariants, the two-layer architecture that separates
cinematography from navigation-subsystem, and the warp-exit handoff
criteria). Secondary contracts: §2 Star Systems (autopilot as consumer
of generator output) and §5.3 Drive States (autopilot as a camera-
writer during system tours). The numeric change this workstream ships
fits entirely within §10's navigation-subsystem layer — safe-distance
rules around bodies — and does not touch cinematography-layer
concerns.

**Prior contract citation (pre-landing legacy, kept for history):**
this brief was originally scoped parenting against §2 + §5.3 of
SYSTEM_CONTRACTS before the feature doc and §10 existed. The
retroactive tightening above supersedes that scoping.

## Implementation plan

N/A (feature is workstream-sized). Single-system numeric tune backed by
AC recording verification. No cross-system contracts or state machines
involved.

## Scope statement

Widen the autopilot's orbit approach distance around stars so the ship
settles at a perceptually comfortable distance rather than skimming the
photosphere. Planet and moon approach distances are unchanged — Max's
observation (2026-04-19 dimness-undo recording review, followup #5 in
`docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md` §Followups)
is that the post-warp arrival orbit around the destination star reads
as "way too close," while planet/moon stops read correctly.

This is one unit of work because the fix lives in two adjacent call
sites that compute the same quantity (`stop.orbitDistance` for a
`stop.type === 'star'` tour stop) and the verification artifact is a
single pair of motion recordings (star approach + planet approach) that
together demonstrate the contrast. Splitting the two call sites across
briefs would risk one path being fixed and the other drifting.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience / **Discover**
— the felt experience of arriving at a new system is the payoff for the
warp sequence. A ship that ends up half-inside the star punctures that
payoff with a "the camera is wrong" note before the system can even be
read. The autopilot's arrival orbit is the first frame of "I have
arrived somewhere"; it carries aesthetic weight disproportionate to its
code size.

Advances §11 Development Philosophy **Principle 2 — No Tack-On
Systems** by constraining the fix to numeric tuning of existing
constants rather than introducing a new body-classification layer
(details in Principles and Drift Risks below).

Does NOT advance `docs/FEATURES/warp.md`. This is not a warp concern —
warp exit hands the drive state back to Autopilot per SYSTEM_CONTRACTS
§9.1 EXIT (L252), and Autopilot then runs its own tour logic in
`FlythroughCamera`. The too-close frame is an autopilot frame, not a
warp exit frame. Director's routing call is explicit on this: *"Separate
feature (§Autopilot), separate system, no coupling to the warp work."*

## Scope-pushback on Director framing

Director framed this as *"Simple scope: widen approach radius when
target body is classed stellar vs. planetary."* Two places where the
framing needs adjustment before working-Claude picks up:

1. **"autopilot only" is the right frame, not "any approach-to-body."**
   The Director's routing comment raised the question. Answer: the
   reported failure mode is the autopilot tour stop around the star
   (confirmed by `src/auto/AutoNavigator.js` + the `populateQueueRefs`
   / `populateNavigableQueueRefs` sites in `src/main.js`). Manual flight
   does not compute an "approach distance" — `FlightDynamics` integrates
   thrust; there is no autopilot-equivalent target radius for a manual
   pilot. There is no mining-approach or docking-approach system in the
   codebase today (nav audit: no matches for `mining|docking` in
   `src/` paths related to approach). So "autopilot only" is not a
   narrowing — it is the full surface of the current failure. If later
   workstreams introduce mining / docking / flight-assist approach
   distances, they can cite this brief's numeric decision as prior art
   but must not be bundled into this workstream.

2. **"classed stellar vs. planetary" is already true in the queue; the
   problem is the constant, not the classification.** `AutoNavigator`
   already distinguishes stop types — `stop.type === 'star'` vs
   `'planet'` vs `'moon'` (see `AutoNavigator.js` L37, L60, L70). The
   star-specific branch in `populateQueueRefs` already exists
   (`main.js` L3733–3740) and already uses a larger multiple (8×)
   than the planet branch (2.8× at L3746). Max's observation is that
   8× is still visually too close for stars in practice. The fix is
   tuning the star multiple upward, not introducing a classification
   system. This matters for Principle 2 (see below) — the wrong framing
   would lead working-Claude to invent a `isStarClass()` helper or a
   body-class enum that the code does not need.

Recording the pushback here so the PM-Director disagreement trail is
explicit. If the Director disputes either point, Max breaks the tie.

## Acceptance criteria

Phase-sourced per PM §"Per-phase AC rule" — the only autopilot phase
this workstream touches is the APPROACH phase (`FlythroughCamera.js`
L104 `// APPROACH state (pause → close-in → transition to orbit)`). The
DESCEND, ORBIT, and TRAVEL phases are orthogonal to the target-distance
input and should be unaffected; AC #4 is the regression guard for that.

1. **Star approach target distance — non-binary systems.** The
   `orbitDistance` written to a `stop.type === 'star'` queue entry in
   `main.js::populateQueueRefs` uses at least **`starObj.data.radius
   * 20`** as the unclipped target (up from the current `radius * 8`),
   still capped by `innerOrbit * 0.6` when an inner planet would
   otherwise be crossed. Exact multiple to be negotiated with Max in
   the demo step (see Handoff) — the recording is what settles the
   number. Starting candidate: 20×. Working-Claude does NOT pick the
   number unilaterally; see Drift Risk #1.

2. **Star approach target distance — navigable deep sky (cluster /
   nebula star stops).** The `orbitDistance` written in
   `main.js::populateNavigableQueueRefs` uses at least **`starObj.data
   .radius * 20`** as the floor (up from the current `radius * 4`),
   still with the `nn * 0.15` nearest-neighbor ceiling so cluster
   geometry isn't crossed. Same number-negotiation rule as AC #1 —
   the same multiple should apply to both call sites for consistency.

3. **Planet approach distance unchanged.** `main.js::populateQueueRefs`
   planet branch (L3746) continues to use `radius * 2.8`. Moon branch
   (L3754) continues to use `Math.max(radius * 3, 0.06)`. AC verified
   by reading the diff: the planet and moon lines are not touched.

4. **FlythroughCamera phases other than APPROACH are unaffected.**
   DESCEND, ORBIT, TRAVEL all read `orbitDistance` as an input and
   produce the same qualitative motion for a larger input value
   (orbit radius scales linearly, travel distance scales linearly).
   No state-machine edits, no phase-transition edits. Verified by
   reading the diff: `FlythroughCamera.js` is not touched.

5. **Sol debug-start regression guard** (per
   `feedback_always-test-sol.md`). Sol is served by `KnownSystems` →
   `SolarSystemData`, which feeds `system.star.radius` through the
   same `starObj.data.radius` path. The Sol autopilot tour's first
   star stop must settle the camera at an orbit distance that visibly
   contains the solar corona rather than clipping it. Verified in
   the recording pair (AC #6 — one of the two recordings IS the Sol
   arrival).

6. **Motion evidence at ship-gate.** Per Director's routing call and
   `docs/MAX_RECORDING_PROTOCOL.md` §Canvas path: two canvas
   recordings captured via `~/.claude/helpers/canvas-recorder.js` +
   `~/.local/bin/fetch-canvas-recording.sh`, each 5–8 s:
   - `screenshots/max-recordings/autopilot-star-approach-2026-04-20.webm`
     — full autopilot approach-to-orbit sequence around the system
     star (Sol preferred for regression-guard overlap with AC #5).
   - `screenshots/max-recordings/autopilot-planet-approach-2026-04-20.webm`
     — full autopilot approach-to-orbit sequence around a planet in
     the same system, for contrast.
   ACs #1, #2, #3, #5 are evaluated against the pair. Per the Shipped-
   gate protocol: working-Claude closes at `VERIFIED_PENDING_MAX
   <commit-sha>` after the commit lands and the recordings are on
   disk. The Shipped flip happens on Max's verdict against the
   recordings, not on agent inspection of `stop.orbitDistance`
   values in the console.

7. **One commit for the numeric change.** Commit message shape:
   `fix(autopilot): widen star approach distance — 8×/4× → 20× star
   radius`. Commit body cites this brief path, names both touched
   sites (`populateQueueRefs`, `populateNavigableQueueRefs`), and
   notes the planet/moon formulas untouched. No doc edits in this
   commit except the brief's own Status line update.

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 are load-bearing here.
Two (Per-Object Retro Aesthetic, BPM-Synced Animation) are orthogonal
to an approach-distance constant and are omitted.

- **Principle 2 — No Tack-On Systems.** This is the headline principle
  for this workstream per Director's routing. The failure mode is
  obvious: "the fix is to check what kind of body this is, so let's
  add a `BodyClassifier` module / `isStellarClass(body)` helper / a
  new `bodyClass` enum on the stop object / an `approachDistanceFor
  (body)` factory." None of those are needed. The queue already knows
  `stop.type`. The generation side already stamps `star.type` (O/B/A
  /F/G/K/M/white-dwarf/etc.) onto `systemData.star` — used by
  `ExoticOverlay.js` and `NameGenerator.js`. If a future workstream
  ever wants per-spectral-class approach tuning (neutron stars vs.
  K-giants), the hook is already there. *Violation in this workstream
  would look like:* adding a `getApproachDistance(bodyType, radius)`
  helper in a new file; adding an `ApproachDistanceRegistry`; adding
  spectral-class-conditional multipliers before Max asks for them. The
  clean answer is: two numbers change in two existing branches.

- **Principle 6 — First Principles Over Patches.** The first-principle
  question for an autopilot approach distance is *"what does the
  viewer see at this distance?"* At 8× star radius for a 1 R☉ sun the
  sun fills roughly `2 × atan(1/8) ≈ 14°` of the 70° FOV — the star
  is a large bright disc but the camera is well inside the corona
  bloom that StarFlare renders. At 20× the disc is ~5.7° of FOV —
  moon-from-Earth sized, with the corona fitting in the frame. The
  first-principles answer is "the number that frames the authored
  visual" — which requires looking at the recording with Max, not
  guessing at a desk. *Violation in this workstream would look like:*
  picking a number from pure geometry reasoning and shipping without
  the recording; or picking a number to match a reference game (No
  Man's Sky, Elite Dangerous) rather than Well Dipper's authored
  StarFlare aesthetic.

- **Principle 3 — Per-Object Retro Aesthetic** (tangentially). The
  star's authored aesthetic object is `StarFlare` — the diffraction
  spikes + corona bloom that reads as "star" in this game's visual
  language. An approach distance that clips that authored object
  (camera inside the corona bloom) violates the per-object aesthetic
  by rendering *through* the object rather than *of* it. This is why
  the recording matters more than the formula: the AC is "the
  StarFlare reads as a star" not "the ship is N × radius away."
  *Violation in this workstream would look like:* picking a number
  that technically clears the photosphere but sits inside the
  diffraction-spike extent.

- **Principle 1 — Procedural Everywhere** (diagnostic, not prescriptive).
  The fix must not be "pin a literal absolute world-unit distance for
  stars" — that would ignore the wide radius distribution between M
  dwarfs (~0.3 R☉) and O supergiants (>25 R☉). The multiplier form
  (`radius * N`) already honors procedural variance; keep that form.
  *Violation in this workstream would look like:* `stop.orbitDistance
  = Math.max(starObj.data.radius * 8, 2000)` where the floor is a
  magic absolute number. The multiplier alone is the right shape.

## Drift risks

- **Risk: Working-Claude picks the number unilaterally.** The ACs say
  "at least 20×" as a starting candidate. The actual shipped number
  is the one that Max sees in the recording and accepts. A session
  under demo pressure will be tempted to ship 20× without the
  negotiation.
  **Why it happens:** the recording costs a round-trip with Max; the
  number-picking feels like the kind of thing that can be decided
  from code. It cannot — see Principle 3 above.
  **Guard:** the commit does not close the workstream to Shipped. It
  closes to `VERIFIED_PENDING_MAX`, Max reviews the pair of
  recordings, and the number is negotiated in that review. If Max
  says "go tighter" (e.g., 15×) or "go wider" (e.g., 30×), the
  workstream absorbs one more commit with the revised number and a
  new recording, then closes.

- **Risk: Building a body-classification system.** Principle 2 above
  names this as the headline failure mode. The seductive version: a
  future session looks at this fix, thinks "this is ad-hoc, let me
  extract it into an `ApproachDistancePolicy` module so neutron stars
  and black holes can be tuned separately later," and ships an
  architectural change under the scope of a numeric tune.
  **Why it happens:** the refactor feels clean; the fix feels dirty
  without it.
  **Guard:** the diff is two numbers on two lines (plus an adjacent
  comment update). Any diff wider than that is an escalation trigger
  — stop, do not commit, surface to Director.

- **Risk: Expanding scope to "any approach to any body."** Director's
  routing explicitly asked this question; the scope-pushback section
  above answers it (autopilot-only; no other approach system exists
  today). But mid-work a session may notice that `FlightDynamics`
  exists and wonder if manual flight should auto-limit approach
  distance around stars.
  **Why it happens:** "while we're in the autopilot area, let's make
  manual flight safe too" — the exact shape of Warp Drift Risk #4
  (scope-creep) from the sibling warp-hyper-dimness-undo brief.
  **Guard:** AC #4 (phases other than APPROACH unaffected) + AC #7
  (one commit, two sites). Any edit to `FlightDynamics.js`, any new
  safety-radius concept, any manual-flight autopilot-assist surface
  is a new workstream and goes into a `## Followups` section, not
  into this commit.

- **Risk: Accepting Playwright-screenshot substitution for the motion
  verification.** The sibling warp-hyper-dimness-undo brief's
  recording protocol is load-bearing for phase-sourced visual
  features. A star approach IS a time-windowed phenomenon (the ship
  closing in over ~5–8 s; the final framing only makes sense at the
  moment of orbit entry). A mid-approach screenshot can show the
  star fills the frame — it cannot show whether the final orbit
  position frames the StarFlare correctly.
  **Why it happens:** the canvas recorder adds 30–60 s of round-trip
  over a screenshot; the screenshot feels "close enough."
  **Guard:** AC #6 names the recording pair explicitly. The
  Shipped-gate (`VERIFIED_PENDING_MAX` → `Shipped`) does not flip on
  screenshots per `docs/MAX_RECORDING_PROTOCOL.md`.

- **Risk: Testing on a generated seed but not Sol.** Per
  `feedback_always-test-sol.md`, Sol is served by the
  `KnownSystems`/`SolarSystemData` path, which is a distinct code
  path from the `StarSystemGenerator` path. A working-Claude session
  that verifies on seed 42 and not Sol may miss a Sol-specific
  regression (e.g., if `SolarSystemData.star.radius` is in different
  units).
  **Why it happens:** whatever system is loaded in the dev browser
  when work starts is the easiest system to test.
  **Guard:** AC #5 + AC #6 require the star-approach recording be
  of the Sol approach, not a generated seed. Planet-approach
  recording can be any system but the pair reads cleanest if both
  are from Sol (e.g., star stop + Earth stop in the same tour).

## In scope

- **`src/main.js::populateQueueRefs` star branch** (currently
  L3733–3740): replace `starObj.data.radius * 8` with `starObj.data
  .radius * 20` (starting candidate; Max may tune). The `innerOrbit
  * 0.6` cap stays. Adjacent comment should be updated to name the
  new formula.
- **`src/main.js::populateNavigableQueueRefs` star branch** (currently
  L3782–3793): replace `starObj.data.radius * 4` with `starObj.data
  .radius * 20`. The `nn * 0.15` nearest-neighbor cap stays.
  Adjacent comment should be updated likewise. **Both call sites use
  the same multiple** — if one is 20× and the other is 15× the
  behavior diverges based on whether the destination is a normal
  system or a navigable deep sky, which is the wrong axis of
  variability.
- **Canvas recording pair** per AC #6. Working-Claude initiates the
  capture via `~/.claude/helpers/canvas-recorder.js`, fetches with
  `~/.local/bin/fetch-canvas-recording.sh`, and surfaces the files
  to Max with contact-sheet frames at the final-orbit-entry
  timestamp (`~/.local/bin/contact-sheet.sh`) so Max can evaluate
  the framing without scrubbing.
- **One commit** per AC #7.
- **`## Status` line in this brief** flipped from "Scoped" →
  `VERIFIED_PENDING_MAX <sha>` after commit, then to `Shipped <sha>
  — verified against <recording-path-pair>` after Max's verdict.

## Out of scope

- **Bootstrapping `docs/FEATURES/autopilot.md`.** Director-owned,
  separate session. Flagged in Parent Feature section.
- **Adding an Autopilot section to `docs/SYSTEM_CONTRACTS.md` with
  an approach-distance constants table.** Director-owned, follows
  the feature doc bootstrap.
- **Per-spectral-class tuning (neutron-star close passes, black-hole
  accretion-disk hover, white-dwarf minimum distance).** If Max
  wants these later, they are separate workstreams citing this one
  for the baseline formula. Today the radius-multiplier form already
  handles the wide range of main-sequence radii procedurally.
- **Manual flight approach safeguards / flight-assist auto-braking
  around stars.** Separate workstream if it ever becomes a feature;
  no such feature exists in the code today.
- **Mining-approach, docking-approach, scan-approach distances.** No
  such systems exist in the code today. If they are added later,
  they cite this brief for the autopilot-case formula but do not
  reopen this workstream.
- **Changing the autopilot's linger durations, travel durations,
  orbit speeds, or descend behavior.** AC #4 explicitly guards
  against this.
- **Changing planet or moon approach distances.** AC #3 guards this.
- **`warp-exit-drama-polish`, `warp-fold-fps-hitch`, `warp-inside-
  entry-freeze`, `warp-exit-smoothness`.** Sibling followups from
  the dimness-undo close-out; each is its own workstream.

## Handoff to working-Claude

Read this brief first. Then, in order:

1. `docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md`
   §"Followups surfaced during verification" item #5 — the original
   observation in Max's words.
2. `docs/MAX_RECORDING_PROTOCOL.md` — Canvas path (agent-initiated
   capture). This workstream uses the canvas path, not the DOM-only
   fallback.
3. `src/auto/AutoNavigator.js` — short file (~200 lines). Read the
   `buildQueue` / `buildNavigableQueue` functions to see how stops
   are structured; the `stop.type` discriminator is the existing
   classification surface you will NOT re-invent.
4. `src/main.js` L3731–3794 — the two `populate*QueueRefs` functions
   with the star/planet/moon branches. These are the two edit sites.
5. `src/auto/FlythroughCamera.js` L104, L278–314, L540–576 — the
   APPROACH → ORBIT phase handoff. Read-only; do not edit this file.
   Confirms why AC #4 (other phases unaffected) holds by construction
   when only `orbitDistance` inputs change.
6. `feedback_always-test-sol.md` — the Sol regression-guard rationale
   for AC #5.

Then, in order:

1. **Make the edit.** Two lines. Start with 20× as the candidate at
   both call sites. Update the adjacent comments.
2. **Intra-session sanity check via `mcp__chrome-devtools__*`** (per
   `feedback_prefer-chrome-devtools.md`, NOT Playwright). Open the
   dev URL Max is running, trigger a warp-to-Sol or whatever debug
   shortcut spawns Sol, let the autopilot tour arrive at the star
   stop, take ONE screenshot of the settled orbit position. This is
   a self-audit, NOT the Shipped artifact — it will not appear in
   AC evaluation.
3. **Canvas recording pair.** Use `~/.claude/helpers/canvas-recorder
   .js` to capture the two 5–8 s clips named in AC #6. Fetch with
   `~/.local/bin/fetch-canvas-recording.sh`. Generate contact sheets
   at `~/.local/bin/contact-sheet.sh` and surface the final-orbit-
   entry frame from each to Max.
4. **Commit per AC #7.** Stage ONLY `src/main.js` and this brief
   (`docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`)
   — never `git add -A`. The brief edit is just the Status line
   flipping to `VERIFIED_PENDING_MAX <sha>`.
5. **Demo handoff to Max.** Per `feedback_director-producer-demo-
   cycle.md` — full stop. Do not auto-proceed to followups. Surface
   the recording pair + contact sheet frames, state the numeric
   change (`8× → 20×` at site A, `4× → 20×` at site B), ask Max to
   confirm the framing or call a different multiple.
6. **On Max's verdict:**
   - **Accept** — flip Status to `Shipped <sha> — verified against
     <both-recording-paths>` and close. Any polish notes Max raises
     become new `## Followups` entries in this brief.
   - **Retune** — amend with a new multiple, new commit, new
     recording pair, back to step 5.

Artifacts expected at close: one commit (two `src/main.js` edits +
the brief Status flip); two canvas recordings at the paths in AC #6;
this brief at Shipped with both recording paths cited.

**If the diff grows beyond two numeric changes plus adjacent comment
updates, stop and escalate to Director.** Principle 2's failure mode
is the dominant risk in this workstream; an expanding diff is the
early warning.

Drafted by PM 2026-04-20 under Director routing from the
warp-hyper-dimness-undo close-out review.
