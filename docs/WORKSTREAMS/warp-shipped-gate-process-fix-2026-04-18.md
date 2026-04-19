# Workstream: Shipped-gate process fix — Max-recording protocol + per-phase ACs + VERIFIED_PENDING_MAX (2026-04-18)

## Parent feature

None — this is a **process / tooling workstream**, not a game-feature
workstream. The PM persona canonically names feature workstreams as the
default; this brief is the explicit exception. It exists to build the
infrastructure that prevents the `warp-hyper-dimness-2026-04-18.md` miss
(static screenshot accepted as proxy; Shipped flipped before the
authored experience was evaluated in motion) from recurring across any
feature workstream in this project.

The process artifacts it produces are adjacent to the PM persona
canonical file (`docs/PERSONAS/pm.md`) and to the global Dev Collab OS
spec (`~/.claude/CLAUDE.md` §"Development Collaboration OS"). Both are
concerned with *how workstreams close*, which is the exact surface this
brief addresses.

## Implementation plan

N/A — process workstream, three small doc deliverables, each under one
page. No architectural reasoning needed; the deliverables ARE the
artifacts.

## Scope statement

Three small deliverables, one per Shipped-gate failure mode observed in
the dimness miss:

1. A **Max-recording drop protocol** — a convention for how Max captures
   and delivers OS-level screen recordings, and how working-Claude picks
   them up. Fixes the "no artifact class named for motion evidence"
   failure.
2. A **per-phase AC checklist** appended to the PM persona — an aide-
   mémoire for the PM so that any workstream touching a phased or
   animated feature carries an AC per phase it can reach, each sourced
   to the feature doc's phase-criteria section. Fixes the "ACs not
   cross-referenced to feature-doc phase criteria" failure.
3. A **`VERIFIED_PENDING_MAX` → `Shipped` status transition** added to
   the Dev Collab OS spec. Shipped is not available as a status until
   Max's recording is in hand; audits close at `VERIFIED_PENDING_MAX
   <sha>` and wait. Fixes the "Shipped flipped on author/auditor proxy
   evidence alone" failure.

One unit of work because the three deliverables are interdependent: the
recording protocol needs somewhere to live (status gate's artifact),
the per-phase AC rule needs something to verify against (the recording),
and the status gate needs something concrete to wait for (the recording,
per the recording protocol). Split and each half is load-bearing on the
other half.

## How it fits the bigger picture

The Dev Collab OS (per `~/.claude/CLAUDE.md` §"Development Collaboration
OS") is the operating system for how Max and Claude build software
together. This workstream is a patch to that OS — a specific gate added
to the Project/Feature Lifecycle's REVIEW phase. Today the Lifecycle's
REVIEW phase ends with *"Director reports alignment + drifts caught;
PM reports criteria coverage. Lessons to memory + Obsidian."* That
leaves the Shipped-flip unguarded on when the evidence is sufficient to
support the flip. The dimness miss showed that gap is live: Director
and PM can both sign off on proxy evidence if no process artifact
requires motion-class evidence.

Against `docs/GAME_BIBLE.md` §"Principle 6 — First Principles Over
Patches": the miss this brief fixes is the second-order version — not
patching a shader, but patching a *workflow*. The first-principles
question is *what kind of evidence can close a visual workstream?* and
the honest answer is *what Max sees when he runs the game, captured in
motion by Max himself*. The three deliverables encode that answer.

This brief's own success is tested by its first consumer: the sibling
un-do brief (`warp-hyper-dimness-undo-2026-04-18.md`) applies all three
deliverables. If the sibling brief can cite the protocol, use the
`VERIFIED_PENDING_MAX` status, and reference the phase-sourced ACs
cleanly, the deliverables are adequate. If the sibling brief has to
route around any of them, iterate the deliverables here.

## Acceptance criteria

1. **`docs/MAX_RECORDING_PROTOCOL.md` exists and is self-contained for a
   future Claude with no prior context.** Covers: (a) how Max captures
   on Windows (Win+G Xbox Game Bar → record screen, OR Win+Shift+R
   Snipping-Tool recording, OR OBS as heavier fallback — name all three
   so the doc survives one tool being unavailable); (b) target drop
   path format `screenshots/max-recordings/<workstream-slug>-<YYYY-MM-
   DD>.<ext>`; (c) supported extensions `.mp4`, `.mov`, `.webm`; (d) how
   Max signals delivery in chat ("recording at <path>" — plain text,
   no special ceremony); (e) how working-Claude verifies (Read-tool
   fails for video binaries, so verification is a `ls -la` equivalent
   reporting file size and extension, NOT a visual parse — working-
   Claude cannot watch the video, Max is the evaluator); (f) what
   happens if the file is missing or zero-bytes (ask Max to re-export).
   One page. No pipeline building.

2. **PM persona file has a per-phase-AC checklist section.** Appended
   to `docs/PERSONAS/pm.md`. Five-to-eight lines. Names the rule (for
   phased/animated features, each AC must cite the feature-doc phase
   section it verifies), the template shape (`[Phase] — [criterion
   phrase verbatim from feature doc] (per <feature-doc-path> §"<section
   name>")`), and the class of features where this applies (warp,
   transitions, any animation sequence, progressive reveals). Not a
   full workflow rewrite.

3. **`~/.claude/CLAUDE.md` §"Development Collaboration OS" describes
   the `VERIFIED_PENDING_MAX` → `VERIFIED`/`Shipped` transition.**
   Edit adds: (a) the two status strings, (b) when each applies
   (`VERIFIED_PENDING_MAX <sha>` at audit close when the Shipped
   artifact is a Max-driven recording that hasn't arrived yet;
   `Shipped <sha>` after Max's recording is on disk and the ACs have
   been evaluated against it), (c) the explicit rule that Shipped is
   not a valid flip on proxy evidence when the feature is visible /
   animated / phased. Flagged for Max's eyeball since it's a user-
   visible edit to a file Max owns — see §"Ownership" below.

4. **Sibling un-do brief applies all three deliverables cleanly.**
   `docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md` cites the
   recording protocol path, has per-phase ACs citing
   `docs/FEATURES/warp.md` sections, and closes at
   `VERIFIED_PENDING_MAX <sha>` before Shipped. If the sibling brief
   has to route around any of the three, that's iteration signal on
   the deliverables, not acceptance.

## Principles that apply

(From `docs/GAME_BIBLE.md` §11 Development Philosophy. Two principles
are load-bearing for a process workstream; the other four are
feature-oriented and not directly relevant here.)

- **Principle 6 — First Principles Over Patches.** The dimness miss
  was a proxy-evidence acceptance. Patching would be "next time, look
  harder at the screenshots." First-principles is *what class of
  evidence can answer the criterion?* For time-windowed motion
  phenomena (destination-star crowning during HYPER, exit recession),
  the answer is motion evidence — a recording. The three deliverables
  encode the principle as process so it does not need to be
  re-derived each session.
  *Violation in this workstream would look like:* shipping a
  sophisticated automated video-diff pipeline, a Playwright video-
  recorder integration, or a frame-diff dashboard. Each is a patch
  over the first-principles answer (*Max records, Max evaluates, we
  pick up the file*). The simplest artifact that answers the
  criterion is the right one.

- **Principle 2 — No Tack-On Systems.** The VERIFIED_PENDING_MAX
  status is a single new status state; it is not a new tracking
  system or ticketing layer. Its source of truth is the workstream
  brief's `## Status` line, same as `Drafted` / `In progress` /
  `Shipped`. Adding a separate pending-recording registry, an index
  file, a board, or a dashboard would be Principle 2 violation.
  *Violation in this workstream would look like:* building
  `docs/SHIPPED_GATE_QUEUE.md`, a GitHub project board, or a CI-side
  Shipped-guard automation. The status lives in the brief; one
  surface, not two.

## Drift risks

- **Risk: Over-engineering the recording protocol.** Temptation:
  write automated frame extraction, video-diff tooling, expected-
  duration validation, format-normalization pipeline, FFmpeg
  wrapper, time-synced Playwright/OS-recording fusion.
  **Why it happens:** automation feels like leverage; capturing
  requirements feels like busywork. Each automation item is also
  individually defensible ("we could verify duration automatically")
  even though none of them solve the underlying miss.
  **Guard:** AC #1 caps the doc at one page and explicitly names
  "no pipeline building." If the protocol grows past one page,
  scope-creep has happened; trim back before merging.

- **Risk: PM persona checklist creep.** The per-phase-AC rule is
  five to eight lines. Temptation is to append a full "authoring a
  good workstream brief" workflow rewrite.
  **Why it happens:** the PM persona is a natural place to put more
  PM guidance; once you're editing it, adding adjacent items feels
  organic. Also: the dimness miss had several PM-side contributing
  factors (AC phrasing, close-out acceptance standards) that could
  each motivate a checklist item.
  **Guard:** AC #2 caps at five to eight lines and focuses strictly
  on the phase-sourced-AC rule. Other PM guidance goes in other
  workstreams or, if small enough, is not workstreamed — it's a
  lessons-learned note.

- **Risk: Orphan status state.** If `VERIFIED_PENDING_MAX` is added
  to the Dev Collab OS spec but no brief actually uses it — or uses
  it inconsistently — the state becomes invisible fiction. The
  Director and PM forget it exists; Shipped flips on proxy evidence
  again.
  **Why it happens:** status states drift when they don't have a
  single clear source of truth. A new state in a global doc is not
  automatically enforced at the workstream level.
  **Guard:** AC #4 — the state lives in the brief's `## Status`
  line. No separate index, no separate registry. The sibling
  un-do brief is the first consumer and its usage IS the test that
  the state works. If the sibling brief's close-out cannot be
  cleanly written under the new state, the state design is wrong
  and iterates here.

- **Risk: Max edit slipped in without Max eyeballing.** AC #3
  edits `~/.claude/CLAUDE.md`, which is Max's file. Max greenlit
  execution of this workstream in the invocation message, which
  covers the edit — but the edit is user-visible and needs Max's
  eyeball in practice.
  **Why it happens:** "Max said go, so go" is a valid reading; it
  is also the reading that silently lands phrasings Max would have
  tuned.
  **Guard:** §"Ownership" below names the CLAUDE.md edit as
  "proposed, awaits Max's acceptance." Working-Claude makes the
  edit (not leave it as a separate draft) but flags it clearly in
  the commit message so Max can eyeball and adjust.

## In scope

- **Deliverable 1: `docs/MAX_RECORDING_PROTOCOL.md`.** New file. One
  page. Covers Max's capture options, drop path convention,
  supported extensions, delivery signal in chat, working-Claude's
  verification step, missing-file fallback.
- **Deliverable 2: Per-phase AC checklist in `docs/PERSONAS/pm.md`.**
  Edit to existing file. Append a subsection under §"What you
  produce" or the nearest structurally equivalent section. Five to
  eight lines. Template snippet inline.
- **Deliverable 3: VERIFIED_PENDING_MAX → Shipped status transition
  in `~/.claude/CLAUDE.md` §"Development Collaboration OS."** Edit
  to existing file. Adds the two status strings, their meanings,
  and the anti-proxy-evidence rule. Max's user-visible file; commit
  message flags the edit for Max's eyeball.
- **Commit.** Stage the three specific paths (not `git add -A`).
  Commit message shape: `process(dev-collab): Max-recording
  protocol + per-phase ACs + VERIFIED_PENDING_MAX gate`. Commit
  body references this brief path and the dimness-miss provenance.
- **Close at `Shipped <sha>` once the sibling un-do brief has
  applied all three deliverables** (AC #4). This brief does NOT
  need a Max-recording to close — its artifacts are text, not
  motion. The `VERIFIED_PENDING_MAX` gate applies to visible /
  animated / phased feature workstreams, not to doc-only process
  work.

## Out of scope

- **Automated video-diff / frame-extraction / duration-validation
  pipeline.** Principle 6 violation; see Drift risks. If the
  protocol proves inadequate with real usage, iterate the protocol
  — do not reach for automation first.
- **Playwright video recording integration.** Playwright is an
  intra-session tool; its outputs are working-Claude-authored, not
  Max-authored. The entire point of the gate is Max-in-the-loop
  evidence.
- **Broader PM persona rewrite.** The per-phase-AC rule is the
  single PM-persona addition this brief makes. Other PM-persona
  sharpening (close-out acceptance standards, workstream-kickoff
  checklist, handoff-formality tightening) are separate workstreams.
- **Broader Dev Collab OS rewrite.** Only the VERIFIED_PENDING_MAX
  transition is in scope; the rest of the §"Development
  Collaboration OS" section is untouched.
- **Changing the Director persona.** The Director audit miss is
  fixed by the workflow artifacts here, not by rewriting the
  Director persona. If a future session identifies a Director-
  persona-specific change needed, that's a separate workstream.
- **Retroactively flipping past Shipped statuses.** Past briefs
  stay as-is; the gate applies forward. (The sibling un-do brief
  handles the specific doc reversals for the dimness miss; those
  reversals are Director-owned and flagged in the un-do brief.)
- **Adding the protocol to feature-doc authoring.** Feature docs
  are Director-owned and are upstream of workstreams. The gate
  belongs at workstream close, not feature-doc authoring.

## Ownership

- **Writing the three artifacts:** working-Claude, under the PM
  brief. PM authors the brief (this file); working-Claude implements
  the three artifacts per the ACs.
- **`docs/MAX_RECORDING_PROTOCOL.md`:** new file, working-Claude
  authors, PM reviews content against AC #1 if Max wants.
- **`docs/PERSONAS/pm.md` edit:** working-Claude writes the
  five-to-eight-line subsection. PM-persona canonical file — the PM
  persona itself is effectively the reviewer (same session).
- **`~/.claude/CLAUDE.md` §"Development Collaboration OS" edit:**
  working-Claude writes the edit inline. Max's file; edit is
  **proposed, awaits Max's acceptance** in the sense that Max's
  "continue and fix this" in the parent invocation covers the edit
  landing, but the commit message flags the specific §"Development
  Collaboration OS" change so Max can eyeball and adjust at his
  convenience. If Max rejects the phrasing, iterate in a followup
  commit.
- **Status transitions on this brief:** PM-owned. Drafted → In
  progress (when working-Claude starts) → Shipped (when AC #4
  confirms the sibling un-do brief has consumed all three
  deliverables cleanly).

## Handoff to working-Claude

Read this brief. Then `~/.claude/CLAUDE.md` §"Development
Collaboration OS" (the section you'll be editing). Then
`docs/PERSONAS/pm.md` (the section you'll be appending to —
identify the right section by reading the file in full; target the
§"What you produce" structure or its equivalent). Then
`docs/WORKSTREAMS/warp-hyper-dimness-undo-2026-04-18.md` (the
sibling brief that will consume the three deliverables — its ACs
and Handoff section name the protocol, the phase-sourced ACs, and
the `VERIFIED_PENDING_MAX` gate already; the deliverables should
match what the sibling brief assumes).

Then, in order:

1. **Draft `docs/MAX_RECORDING_PROTOCOL.md`.** One page. Follow
   AC #1's coverage list. Keep the capture-options section factual
   (Xbox Game Bar Win+G, Snipping-Tool Win+Shift+R recording, OBS
   fallback). Name the verification step honestly: working-Claude
   cannot watch the video; verification is file-existence and size
   check plus Max's own evaluation against ACs.
2. **Append the per-phase AC checklist to `docs/PERSONAS/pm.md`.**
   Five to eight lines. Template snippet inline. Cite the sibling
   un-do brief's ACs #1–#5 as a worked example reference (their
   phase-sourced phrasing matches what this checklist prescribes).
3. **Edit `~/.claude/CLAUDE.md` §"Development Collaboration OS"**
   to add the `VERIFIED_PENDING_MAX` → `Shipped` transition. Two
   status strings, when each applies, the anti-proxy-evidence
   rule. Keep the addition tight — the existing section is Max's
   writing; match its register.
4. **Stage the three specific paths and commit.** Not `git add -A`.
   Commit message per AC #7 format in the sibling brief is the
   wrong shape here; use `process(dev-collab): Max-recording
   protocol + per-phase ACs + VERIFIED_PENDING_MAX gate` with a
   body that names the `~/.claude/CLAUDE.md` edit explicitly so
   Max can eyeball.
5. **Notify in chat:** *"Process fixes landed. `~/.claude/CLAUDE.md`
   §Dev Collab OS has a new VERIFIED_PENDING_MAX status state —
   please eyeball and adjust phrasing if you want. Sibling un-do
   brief can now consume all three deliverables."* Let Max review
   at his own cadence; do not block further work on his response.
6. **Update §"Status" in this brief to Shipped** once the sibling
   un-do brief has visibly applied the three deliverables (cites
   the protocol path, uses phase-sourced ACs, closes at
   `VERIFIED_PENDING_MAX <sha>`). That may happen in the same
   session (if the sibling brief is executed in the same turn) or
   in a follow-up session. Either is fine; the PM will close when
   AC #4 is verifiable.

Artifacts expected at close: three files created/edited, one
commit, this brief Status line flipped to Shipped with the commit
SHA. No Max-recording required for this workstream — it is
process/docs only, the `VERIFIED_PENDING_MAX` gate does not apply
to itself.

## Status

**Drafted by PM 2026-04-18.** Awaiting working-Claude execution.
Status transitions expected: `Drafted` → `In progress` → `Shipped
<sha>` (on AC #4 confirmation — sibling un-do brief consuming all
three deliverables).
