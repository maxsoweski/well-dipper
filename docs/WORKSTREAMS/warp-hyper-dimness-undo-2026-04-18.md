# Workstream: Warp HYPER dimness — un-do the INSIDE-mesh-scale fix (2026-04-18)

## Parent feature

`docs/FEATURES/warp.md` — specifically:

- §"Phase-level criteria (V1) HYPER": *"tunnel geometry is cylindrical and
  extends into distance. Starfield tunnel (not sphere interior).
  Destination visible at the far end at some point during HYPER."*
- §"Phase-level criteria (V1) EXIT": *"crowning transition, camera
  continuous, end state is flying in the destination system."*
- §"Phase sequence EXIT": *"There is a moment where the ship's front has
  emerged into destination space but the rear is still in the tunnel."*
- §"Current state snapshot (2026-04-18)" — the HYPER and EXIT lines were
  updated by `bde5850` to claim Shipped behavior this un-do reverses.
  Flagged for Director doc-reversal below.

## Implementation plan

`docs/PLAN_warp-tunnel-v2.md` — no new PLAN steps. This is a rollback +
re-gate, not new architecture.

## Scope statement

Un-do commit `81dda69` ("fix(warp): pipeline — tunnel mesh scale in INSIDE
mode — restore HYPER starfield"). That commit scaled the 3D `WarpPortal`
tunnel mesh to `(1.5e7, 1.5e7, 1.5e5)` during INSIDE mode to try to brighten
HYPER. The Director audit reviewing this session established that the tunnel
experience during HYPER is in fact rendered by the **compositor**
(`src/rendering/RetroRenderer.js` `hyperspace()` shader at L420–492 plus the
HYPER/EXIT gate at L660–723) — ray-cone tunnel depth, destination-star
crown at L486–489, `uTunnelRecession` EXIT widening, `uExitReveal` fizzing
reveal. The 3D mesh is cosmetic. Before `81dda69` it was microscopic and
barely rendered; after `81dda69` it is huge and `DoubleSide` and writes
opaque procedural-starfield fragments into the `sceneTexture` that the
compositor's `hyperspace` pass then composites *with* — i.e., the mesh now
occludes the compositor's authored HYPER/EXIT experience (the long tunnel,
the crowning destination star, the fizzing exit reveal). The un-do restores
the compositor as the sole author of the HYPER/EXIT visual.

This is one unit of work because the revert, the re-open of the sibling
brief, and the Max-recording verification are one sequenced cleanup. Split
any of them off and the tree is inconsistent with itself.

**Approach decision — revert, not surgical.** Two options considered:

1. **Revert `git revert 81dda69`.** Removes the INSIDE-mode scale block at
   `src/effects/WarpPortal.js` L683–704, the `TUNNEL_INSIDE_RADIUS_SCALE` /
   `TUNNEL_INSIDE_LENGTH_SCALE` constants, and the long comment block
   explaining them. Tree returns to the `a1ff634` state for the portal.
2. **Surgical `this._tunnel.visible = false` during INSIDE.** Adds one
   visibility line in `setTraversalMode('INSIDE')`. Leaves the scale-up
   block and constants in the tree as dead code (visible mesh never
   renders), plus the commit message history carrying the wrong rationale.

PM picks **revert**. Reasons:

- `81dda69` is the tip of `WarpPortal.js` history (`git log -- src/effects/WarpPortal.js` confirmed) — a clean `git revert` has no merge
  risk.
- The surgical path leaves cosmetic dead code that encodes a specific wrong
  design decision. Future sessions reading the file will see scale-up
  constants plus a very persuasive comment about "TARDIS bigger on the
  inside" and at least some of them will reintroduce the bug under a
  different trigger. Revert erases the seductive surface.
- Revert is the most literal un-do and the Director's language was *"revert
  is likely correct."* When the Director and PM agree, bias toward the less
  clever option.

Surgical becomes the fallback only if `git revert 81dda69` produces a
conflict — it should not, but if it does, working-Claude's escalation is
the surgical line plus a note in the commit body explaining why revert
failed.

## How it fits the bigger picture

Restores honest `docs/FEATURES/warp.md` §"Current state snapshot" for
HYPER and EXIT. The snapshot was updated by `bde5850` to claim the HYPER
line now passes V1 and EXIT still renders the crowning — both claims
rested on static mid-HYPER PNGs that could only answer *are stars
visible*, not *does the compositor's long-tunnel / crowning-star / exit-
reveal experience still read*. With `81dda69` in place the compositor's
authored experience is visually overridden by the scaled mesh. The un-do
restores the pre-`81dda69` rendering path so the feature doc snapshot
can again be written from evidence rather than from a proxy.

Restores fidelity to `docs/GAME_BIBLE.md` §"The Warp as Sacred Experience"
and to the feature doc's core mental model — §"Lore / mechanism": *"The
ship is an 'exotic mechanism that can control gravity.' ... Motion
through the tunnel is a property of the tunnel itself."* The compositor's
`hyperspace()` is the shader that encodes this — depth toward a vanishing
point, destination star crowning at the far end, walls receding during
EXIT. The 3D mesh does not encode that; it's a cylinder of procedural
stars. Letting the compositor own HYPER/EXIT is what §"Sacred Experience"
requires.

Advances the Dev Collab OS gate established this session (see sibling
process-fix brief) by being the first workstream audited under
VERIFIED_PENDING_MAX → VERIFIED, and by requiring a Max-driven OS-level
screen recording as the Shipped artifact.

## Acceptance criteria

Acceptance criteria for this workstream are phase-sourced from
`docs/FEATURES/warp.md` §"Phase-level criteria (V1)" per the Director's
new rule that any workstream touching a warp-phase rendering path must
carry an AC per phase it can reach. The un-do touches HYPER (primary),
ENTER (the INSIDE-scale block would have affected the ENTER→HYPER
handoff), and EXIT (the scaled mesh occluded compositor EXIT recession).
FOLD is not reached — portal aperture math is pre-INSIDE and independent.

1. **HYPER — tunnel geometry reads as cylindrical extending into
   distance** (per `docs/FEATURES/warp.md` §"Phase-level criteria (V1)
   HYPER": *"tunnel geometry is cylindrical and extends into distance.
   Starfield tunnel (not sphere interior)"*). Verified in Max's
   recording: the mid-HYPER window shows the compositor's ray-cone
   perspective — walls receding toward a vanishing point, not a wall-
   texture at near-uniform depth across the screen.

2. **HYPER — destination visible at the far end at some point during
   HYPER** (per §"Phase-level criteria (V1) HYPER": *"Destination
   visible at the far end at some point during HYPER"*). Verified in
   Max's recording: at some frame during the HYPER window, the bright
   spot at the vanishing point (the compositor's `centerGlow` at
   `RetroRenderer.js` L486–489) is visible through the tunnel mouth.

3. **EXIT — crowning transition, camera continuous** (per
   `docs/FEATURES/warp.md` §"Phase-level criteria (V1) EXIT":
   *"crowning transition, camera continuous, end state is flying in the
   destination system"*; and §"Phase sequence EXIT": *"a moment where
   the ship's front has emerged into destination space but the rear is
   still in the tunnel"*). Verified in Max's recording: at the HYPER→
   EXIT transition the compositor's `uTunnelRecession` widening
   (`RetroRenderer.js` L429–430) and `uExitReveal` fizzing edge
   (L683–713) render visibly; no hard cut to destination system.

4. **ENTER — camera continuous through threshold** (per §"Phase-level
   criteria (V1) ENTER": *"both-visible partial-in moment occurs cleanly.
   Camera continuous through threshold. No sudden position change"*).
   Verified in Max's recording: the ENTER→HYPER handoff does not exhibit
   a visible mesh-scale pop or any new visual artifact introduced since
   pre-`81dda69`. This is a regression-guard AC — the revert should be
   neutral here; if it is not, the revert has broken something we
   expected to be unaffected.

5. **Seamless — no framerate change at HYPER entry** (per
   `docs/FEATURES/warp.md` §"Primary criterion — 'seamless'":
   *"Framerate change"* is listed as an ANY-phase failure). The sibling
   brief's followup `warp-hyper-perf-inside-shader` noted `81dda69`
   dropped rAF below 30 fps during INSIDE — the revert should restore
   pre-`81dda69` framerate behavior. Verified in Max's recording: the
   HYPER window does not hitch or visibly stutter.

6. **Verification artifact is a Max-driven OS-level screen recording.**
   Not a Playwright filmstrip, not static screenshots. 5–10 s covering
   a full warp from FOLD through EXIT. Dropped at a file path Max names
   in chat (see sibling process-fix brief §"Max-recording drop protocol"
   once that brief lands its artifact; pre-protocol, the default is
   `screenshots/max-recordings/warp-hyper-dimness-undo-2026-04-18.<ext>`).
   Working-Claude reads the file metadata (size, duration if inferrable,
   existence check) and reports back; the ACs above are then evaluated
   against what Max saw. Per the Director's call, **Shipped flips only
   after this recording arrives**; working-Claude closes at
   `VERIFIED_PENDING_MAX <commit-sha>` and waits.

7. **One commit for the un-do.** Commit message shape: `revert(warp):
   un-do 81dda69 INSIDE-mode tunnel mesh scale — restore compositor-
   owned HYPER experience`. Commit body explains the Director's
   compositor-vs-mesh analysis in two sentences and links this brief
   path. No doc edits in this commit — those are Director-owned, flagged
   below.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy. Three principles
are load-bearing; the other three are orthogonal to this un-do and are
intentionally omitted.)

- **Principle 6 — First Principles Over Patches.** `81dda69` was a
  patch over a misdiagnosis. The diagnosis said "shader inputs identical,
  production dim — must be geometry scale at AU units." The missed first
  principle was *which renderer is actually rendering the HYPER tunnel*.
  Answer: the compositor, not the mesh. Once that's named, the mesh-
  scale fix stops being a fix and becomes a regression against the
  compositor's authored experience. The un-do returns the tree to the
  first-principles ground truth: compositor owns HYPER/EXIT; mesh is
  cosmetic and lives only where stencil-clipped OUTSIDE discs use it.
  *Violation in this workstream would look like:* "while we're reverting,
  let's add a mesh-visibility toggle / brightness knob / exposure uniform
  just in case." No. The un-do reverts; it does not add.

- **Principle 2 — No Tack-On Systems.** `81dda69` added a new surface
  (`TUNNEL_INSIDE_RADIUS_SCALE`, `TUNNEL_INSIDE_LENGTH_SCALE`, a per-mode
  scale block) that existed only because the mesh was being asked to do
  a job the compositor already did. The un-do removes the tack-on.
  *Violation in this workstream would look like:* replacing the scale
  block with a `setTunnelVisibleDuringInside(bool)` setter, a debug flag,
  or a "disable for now" comment block left in place. The clean answer
  is one compositor, one cosmetic mesh, zero per-mode overrides.

- **Principle 3 — Per-Object Retro Aesthetic.** The compositor
  `hyperspace()` is the object-coded aesthetic for the warp tunnel — a
  single fullscreen-composited effect owning HYPER/EXIT. `81dda69`
  added a second aesthetic surface (scaled `DoubleSide` mesh) that
  collided with the first in the same screen region. Two surfaces
  competing for the same aesthetic is the exact Principle 3 failure
  mode. *Violation in this workstream would look like:* preserving any
  mesh-driven visual contribution to HYPER "for style" — the rule is
  one surface per object, and HYPER's object-coded aesthetic is the
  compositor's shader.

## Drift risks

This workstream inherits the patch-loop history of `warp-hyper-dimness-
2026-04-18.md` plus a new risk specific to the Director audit miss that
prompted this un-do. Before the risk list: **the Director's own
self-audit from this session** is load-bearing context for how the miss
happened and therefore for what the guards actually have to prevent:

> *"I accepted a proxy. The brief said Visual evidence required and
> listed destination-star crowning and EXIT feel in the warp feature
> criteria, and I closed on a pair of mid-HYPER static PNGs that could
> only answer are stars visible. I rationalized skipping the filmstrip
> by citing the framerate follow-up the commit itself had just flagged
> — which is circular."*

Guards on this brief are written to make the same class of miss
impossible to repeat here.

Risks:

- **Risk: Recreating `81dda69` under a different name.** A future
  session reads `warp-hyper-dimness-2026-04-18.md` §"Close-out findings,"
  sees the "six sparse streaks on mostly black" description of the
  pre-`81dda69` state, and concludes the compositor isn't bright enough
  and re-introduces mesh scaling to "help." This is the dominant risk
  because the sibling brief's close-out currently reads as if the mesh-
  scale fix was correct — `bde5850` updated both the brief and the
  feature doc to reflect Shipped.
  **Why it happens:** the sibling brief's close-out is a compelling read.
  It has a root-cause analysis, matched-inputs screenshots, and a named
  invariant in §9.7 of SYSTEM_CONTRACTS. Future sessions trust it. The
  only thing signaling it was wrong is the re-open notice working-Claude
  appends at the end of this workstream, plus the Director-owned doc
  reversals flagged below.
  **Guard:** in-scope item in this brief — working-Claude appends a
  `## Re-open notice` to `docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md`
  pointing at this brief and stating the Director call. Out-of-scope
  item: bright-walls-via-mesh-scaling is the wrong target; if a future
  HYPER-dimness concern surfaces, the right workstream is
  "tune compositor `hyperspace()` brightness / density / streak," not
  "bring back the mesh."

- **Risk: Using a Playwright filmstrip as the Max-recording
  substitute.** The filmstrip helper at `~/.claude/helpers/filmstrip.js`
  is a useful tool — for intra-session validation. It is not the
  Shipped gate. The Director audit miss turned partly on accepting
  static screenshots as a proxy for motion evidence; filmstrips would
  be a marginally richer proxy but still the wrong artifact class.
  **Why it happens:** filmstrips are available mid-session and produce
  quick close-out-looking evidence. "I already have the filmstrip" is
  frictionless; waiting for Max's recording is not.
  **Guard:** AC #6 names the artifact as explicitly OS-level and Max-
  driven. The sibling process-fix brief formalizes this as the
  `VERIFIED_PENDING_MAX` status gate — Shipped is not available as a
  status until Max's recording file path is in hand.

- **Risk: Static-screenshot substitution.** The exact class of miss
  that closed the sibling brief wrong — mid-HYPER PNGs answered *are
  stars visible* not *does HYPER read as the authored experience*. For
  this un-do the same substitution would answer *are the streaks gone*
  not *is the compositor tunnel + crowning star + exit reveal visible*.
  **Why it happens:** screenshots are low-friction, the crowning star
  is a specific frame-window phenomenon, and tying "did we un-do it"
  to a time-windowed visual is harder than tying it to a still.
  **Guard:** ACs #2 and #3 are written to require the time-windowed
  phenomena directly (destination-star crown at some frame during
  HYPER, EXIT recession + fizz at the handoff). A static screenshot
  cannot satisfy either AC by construction — only a recording can.

- **Risk: Scope-creep into EXIT tuning or compositor tweaks.** Once
  the mesh is out of the way the compositor's HYPER/EXIT experience is
  visible again and may invite tuning temptations: brighter destination
  crown, different recession rate, a sharper fizz edge. These are
  separate workstreams.
  **Why it happens:** "while we're in the warp code" — the classic
  shape. The sibling brief's Drift Risk #4 is the same pattern; the un-
  do inherits it.
  **Guard:** AC #7 is one commit, revert-only. Tuning temptations go
  into a new workstream or a `## Followups` section of this brief.

- **Risk: Inherited — touching orphan/freeze code while in the area.**
  The `10642b2` orphan fix, the `8349e53` Freeze-2 revert, and the
  ENTER freeze all live in `main.js` / `WarpEffect.js` / `WarpPortal.js`
  — the three files this un-do touches (well, one of them). A future
  session reading the diff may be tempted to bundle. The sibling brief
  called this out as its Drift Risk #5 and the call stands.
  **Why it happens:** warp bugs feel like "one bug"; they are not.
  **Guard:** AC #7 one-commit discipline. If the diff surfaces any
  `onTraversal` / `onSwapSystem` / `_portalLabState` / `spawnSystem`
  edit, stop and escalate.

## In scope

- **Revert `81dda69`.** Attempt `git revert 81dda69` first (zero
  conflicts expected per `git log` check: `81dda69` is the tip of
  `src/effects/WarpPortal.js`). If the revert produces conflicts for
  any reason, fall back to the surgical path:
  `this._tunnel.visible = false` inside the `mode === 'INSIDE'` branch
  of `setTraversalMode` (add to the existing mode block near L699–703
  of current `src/effects/WarpPortal.js`); remove the scale-up block
  and the `TUNNEL_INSIDE_*` constants; note the fallback in the commit
  body.
- **Append `## Re-open notice` to the sibling brief**
  (`docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md`). Keep the
  existing `## Status` line and `## Close-out findings` intact as a
  record; add the new notice after close-out, pointing at this brief
  path and stating the Director call (compositor owns HYPER/EXIT;
  mesh-scale fix was visually dominant over the compositor it was
  meant to complement; un-do authored 2026-04-18).
- **Playwright smoke during dev loop.** Not the acceptance artifact,
  but a self-audit step: after the revert, before calling it done,
  working-Claude opens the real flow (click destination, Space × 3)
  and checks that the compositor's HYPER mask still fires (brief
  screenshot of the vanishing-point glow is a useful intra-session
  sanity check; it does NOT close any AC).
- **Commit with the revert and the re-open notice.** One commit; the
  notice is a doc change in the `docs/WORKSTREAMS/` path this PM owns,
  so bundling is clean. (Working-Claude should stage both specific
  paths, not `git add -A`, per repo commit discipline.)
- **Close at `VERIFIED_PENDING_MAX <sha>`**, wait for Max's recording,
  then flip to `Shipped <sha>` after reading the file and evaluating
  against the ACs.

## Out of scope

- **Reversing `bde5850`'s doc edits (SYSTEM_CONTRACTS §9.6 / §9.7 and
  `docs/FEATURES/warp.md` HYPER / EXIT snapshot lines) and reversing
  `40c00ca`'s Status line flip on the sibling brief.** These are
  Director-owned paths (feature doc, SYSTEM_CONTRACTS) or
  Director-authored status flips on a PM-owned doc that the Director
  needs to explicitly unwind. PM flags below; Director owns the edits.
  The PM-authored `## Re-open notice` on the sibling brief is the PM
  footprint; the actual Status flip on the sibling brief is a
  Director action to match the doc-reversal set.
- **Brighter compositor `hyperspace()`.** If HYPER post-un-do reads
  too dim for Max's taste in the recording, that is a **separate
  workstream** — `warp-hyper-compositor-tuning` or similar, owned by
  a fresh PM session. Not in this workstream, not in this commit.
- **Bringing back the mesh with any per-mode behavior (scale,
  opacity, visibility-gate, alpha, blend-mode, etc.).** If a later
  workstream wants the 3D mesh to contribute something during INSIDE,
  that requires its own feature articulation against `docs/FEATURES/
  warp.md` §"Critical architectural realizations" — the non-Euclidean
  spec constrains mesh-driven contributions sharply, and reintroducing
  any of them goes through a Director-reviewed feature scoping step,
  not through "small tweak" energy.
- **ENTER freeze, Freeze 2, seed threading, Sol-destination verify,
  perf profile.** All inherited from the sibling brief's followup list.
  Each gets its own workstream in a future session.
- **Bible updates.** `docs/FEATURES/_drafts/GAME_BIBLE_diff_warp.md`
  remains unmerged; Director-owned.

## SYSTEM_CONTRACTS.md + feature-doc reversals (flag for Director)

Director-owned edits that need to follow this un-do. PM flags,
Director executes:

- **`docs/SYSTEM_CONTRACTS.md` §9.6 "Uniform-input parity invariant"**
  (added by `bde5850`) — **KEEP.** The invariant stands independent of
  the fix that surfaced it. The lab-vs-production parity rule is a
  correct principle; this un-do does not invalidate it.
- **`docs/SYSTEM_CONTRACTS.md` §9.7 "INSIDE-mode tunnel scale
  invariant"** (added by `bde5850`) — **REVERSE.** §9.7 codified the
  `81dda69` approach as an invariant. With `81dda69` reverted the
  invariant is not just unused, it is wrong — it encodes "INSIDE-mode
  rendering requires scaling the 3D mesh" when in fact the compositor
  owns INSIDE-mode rendering and the mesh should not contribute.
- **`docs/FEATURES/warp.md` §"Current state snapshot (2026-04-18)"
  HYPER line** (updated by `bde5850` to reference `81dda69` as
  achieving the starfield-tunnel criteria) — **REVERSE.** The claim
  rested on static screenshots that could not evaluate the
  compositor's authored HYPER experience. Revised snapshot should
  describe HYPER state post-un-do (compositor-rendered tunnel
  present; brightness / destination-star-timing / streak tuning are
  followup questions).
- **`docs/FEATURES/warp.md` §"Current state snapshot (2026-04-18)"
  EXIT line** (updated by `bde5850` to report EXIT forensics
  confirming crowning transition) — **REVERSE.** The forensics rested
  on the same static-screenshot basis and could not confirm the
  compositor's authored EXIT recession / fizz reveal was actually
  reading. Post-un-do evaluation requires Max's recording.
- **`docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md` Status line**
  (flipped to `Shipped 2026-04-18` by `40c00ca`) — **REVERSE to
  `Re-opened 2026-04-18 — see warp-hyper-dimness-undo-2026-04-18.md`**
  or equivalent. The PM-appended `## Re-open notice` is in this
  workstream's scope; the actual Status-line flip on the sibling
  brief is a Director-aligned act so the Shipped claim doesn't
  conflict with the un-do.

Once this workstream's commit lands, the Director's doc-reversal pass
can cite the un-do commit SHA in its own commit body for traceability.

## Handoff to working-Claude

Read this brief first. Then the Director's report (inline in the
invocation that spawned this brief). Then:

1. `docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md` §"Close-out
   findings" — understand what was claimed Shipped and why the audit
   missed.
2. `docs/FEATURES/warp.md` §"Phase-level criteria (V1)" and §"Phase
   sequence" — these are the ACs' source of truth.
3. `src/rendering/RetroRenderer.js` L420–492 (`hyperspace()` fullscreen
   shader — the actual HYPER tunnel), L486–489 (destination-star
   crown), L660–723 (HYPER/EXIT gate with `uHyperPhase` /
   `uExitReveal`). This is the compositor the un-do restores.
4. `src/effects/WarpPortal.js` L683–704 — the INSIDE-mode scale block
   being reverted.

Then, in order:

1. **Revert.** `git revert 81dda69 --no-edit` (then edit the commit
   message to the form named in AC #7 — `git commit --amend` or
   equivalent). If conflicts, fall back to surgical path per §"In
   scope" and note in the commit body.
2. **Append `## Re-open notice` to
   `docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md`.** Short —
   three or four sentences. Point at this brief path, state the
   Director call, note which doc reversals are flagged for Director.
3. **Vite restart on Max's side.** Working-Claude does not start dev
   servers autonomously (`feedback_no-start-servers.md`). Tell Max
   the exact command — *"Please restart Vite: `pnpm dev` (or `npm run
   dev`) in your WSL terminal. Then open `http://localhost:5173` in
   your Chrome with the debugging extension attached."*
4. **Intra-session sanity check.** Working-Claude opens Chrome on
   port 9223, clicks the dev shortcut that spawns Sol, real-click a
   destination star, Space × 3, watch for the compositor `hyperspace`
   mask firing. Single screenshot of mid-HYPER is fine; it is NOT
   the Shipped artifact.
5. **Ask Max for the recording.** Exact prompt: *"The un-do is on
   disk. Please record a 5–10 s OS-level screen capture of a full
   warp (FOLD through EXIT). Drop the file at
   `screenshots/max-recordings/warp-hyper-dimness-undo-2026-04-18.<ext>`
   and tell me in chat. Any format — .mp4, .mov, .webm — works."*
   (If the sibling process-fix brief has shipped its
   `MAX_RECORDING_PROTOCOL.md` file by this point, cite that file's
   guidance instead of the one-paragraph version here.)
6. **Close at `VERIFIED_PENDING_MAX <sha>`.** Update this brief's
   §"Status" section to `VERIFIED_PENDING_MAX <commit-sha>` after
   the commit lands. Leave Status there — do NOT flip to Shipped
   yet.
7. **On Max's recording arrival:** verify the file exists at the
   path Max names, report back on size / format / approximate
   duration, then evaluate ACs #1–#5 against what Max saw. If all
   pass, flip §"Status" to `Shipped <sha>` with a one-paragraph
   summary citing the recording path. If any fail, escalate — the
   un-do may have surfaced a deeper compositor issue, or the
   compositor's HYPER/EXIT may itself need tuning (separate
   workstream).

Artifacts expected at close: one revert commit; this brief updated
with VERIFIED_PENDING_MAX → Shipped status transition; sibling brief
updated with `## Re-open notice`; Max's recording file on disk.
Director-owned doc reversals happen in a separate commit on a
separate Director turn.

**If any verification step feels like "just needs one more tweak,"
stop and escalate.** The sibling brief's entire lesson is in that
sentence.

## Status

**VERIFIED_PENDING_MAX 0cb717c** — revert shipped 2026-04-18 as commit
`0cb717c` ("revert(warp): un-do 81dda69 INSIDE-mode tunnel mesh scale —
restore compositor-owned HYPER experience"). Code un-do complete; sibling
brief has its `## Re-open notice` appended in the same commit. Awaiting
Max's OS-level screen recording of a full warp (FOLD → EXIT) to
evaluate ACs #1–#5 against the authored experience. Drop path per
`docs/MAX_RECORDING_PROTOCOL.md`:
`screenshots/max-recordings/warp-hyper-dimness-undo-2026-04-18.<ext>`.

Director-owned doc reversals pending (not blocking Shipped on this
brief, but wanted same-session per the miss response):
- `docs/SYSTEM_CONTRACTS.md` §9.7 INSIDE-mode tunnel scale invariant —
  REVERSE.
- `docs/FEATURES/warp.md` §"Current state snapshot (2026-04-18)" HYPER
  and EXIT lines — REVERSE.
- `docs/WORKSTREAMS/warp-hyper-dimness-2026-04-18.md` §"Status" line —
  flip from `Shipped` to `Re-opened — see warp-hyper-dimness-undo-2026-04-18.md`.
- Optionally: §9.6 framing re-anchor per the PM's pushback — §9.6 was
  framed as validated by `81dda69` when in fact it is validated by the
  un-do.

Drafted by PM 2026-04-18. Executed by working-Claude 2026-04-18.
Shipped flips on Max-recording sign-off per AC #6 + MAX_RECORDING_PROTOCOL.
