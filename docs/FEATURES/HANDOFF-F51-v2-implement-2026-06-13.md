# Handoff — F51 rings v2: EXECUTE the 3D-LOD-particle plan (2026-06-13)

**Durable on-disk in the repo** (NOT `/tmp`). Start a FRESH session in
`~/projects/well-dipper` and read this first. **Supersedes the F51-rework portion of**
`HANDOFF-phase4c-rework-2026-06-13.md` — that handoff said "F51 needs a design/brainstorm
pass." **That pass is DONE.** This session designed F51 v2 with Max (brainstorm), wrote the
spec + the implementation plan, and committed them. The next session's job is to **execute
the plan**. Work Item 2 of the prior handoff (F38 airglow + F39 cloud-optics — BUILD both)
is still pending and unchanged; do it AFTER F51 v2.

## TL;DR — what's done, what's next
- **DONE this session:** Ran `superpowers:brainstorming` with Max. Locked the v2 design
  (decisions below). Wrote the spec + a fully-coded implementation plan. Committed both
  (`d08cde7`). No code written yet — design + plan only.
- **NEXT:** Execute the plan task-by-task via **`superpowers:subagent-driven-development`**
  (the plan header names it as the REQUIRED SUB-SKILL). 8 tasks. Build the isolated harness
  first (Tasks 1-6), gate with Max, then integrate into the lab (Tasks 7-8).
- **THEN:** F38/F39 (see the prior handoff's Work Item 2).

## Read these, in order
1. **Plan (execute this):** `docs/superpowers/plans/2026-06-13-f51-rings-3d-lod-particle.md`
   — 8 bite-sized tasks, complete code for the baker/shader/factory/tests, explicit visual
   acceptance criteria + shot filenames for the GPU-Chrome gates.
2. **Spec (the why + design rationale):** `docs/superpowers/specs/2026-06-13-f51-rings-3d-lod-particle-design.md`
3. **Card:** `docs/FEATURES/cards/F51-rings.md` — §7 has Max's v1 rejection (the bar to beat);
   §6.5 is v1's (now-superseded) build plan. Task 8 rewrites these.
4. **Tracker:** `docs/FEATURES/planet-lod-campaign-tracker.md` — F51 row = `🔁 v1 rejected`;
   phase-4c row REOPENED. Task 8 flips them.

## The locked design (so you don't re-litigate it)
Max made these calls during the brainstorm — they are settled, do NOT reopen them:
1. **Purpose = "approach-but-not-through."** Player flies close enough to resolve individual
   particles (a glinting-cloud flyby), but rings are NOT traversable. **No collision, no
   fly-through physics, no gameplay queries.** Rendering problem only.
2. **Particle look = point-sprite glints** — a dense glinting *cloud* with real depth/parallax,
   NOT hero boulders/faceted meshes. Confirmed acceptable after flagging "a sprite is a
   billboard." What sells 3D is context (real 3D positions in a disk with thickness, parallax,
   per-particle shadow), not the sprite shape.
3. **No hero chunks** (third instanced-mesh tier declined).
4. **LOD transition = Approach B ("emergence, not swap"):** the v1 impostor annulus renders
   ALWAYS (far tier / permanent body); a `THREE.Points` cloud on top is sized+faded per-particle
   by camera distance (full near, zero beyond `dCull`). Detail emerges where the camera is close;
   impostor carries the rest → no pop, no dissolve. Cloud placement baked from the SAME
   `generateRingPhysics()` profile the impostor uses → invisible seam.
5. **Stay strictly inside the 6-level posterize + Bayer-dither retro envelope.**

## Subagent execution strategy (Max: "implement via subagents where possible")
Use `superpowers:subagent-driven-development` (fresh subagent per task, review between).
**All `Agent(...)` calls: `model: "fable"`, falling back to `opus` — `fable` was unavailable
in this environment last session, so expect `opus`** (`feedback_subagent-model`,
`agent-opus-enforcer.py` hook enforces it). Suggested split (delegate to conserve main-thread
context per `feedback_delegate-heavy-work-to-subagents`):
- **Subagent-friendly (pure code/tests/ports — dispatch these):** Task 1 (baker + TDD),
  Task 2 (cloud factory + shader + smoke test), Task 3 (harness scaffold), Task 4 (impostor
  port), Task 7 (lab integration code). Give each subagent the plan path + the specific task
  number + the commit-discipline rules. They write code + run `npx vitest run`.
- **Working-Claude drives (live GPU-Chrome visual verification — do NOT blind-delegate):**
  Task 5 Step 4 (the make-or-break LOD visual gate), Task 6 (Max checkpoint), Task 7 Step 4
  (lab visual re-verify), Task 8 (verdict). These need `:9223` chrome-devtools judgment +
  Max's eyes. You CAN dispatch a subagent to run the screenshot sweep and report, but YOU
  judge the result against v1 — and **UAT is Max's gate alone** (`~/.claude/docs/dev-collab-os.md`).
- **Per-task review:** after each subagent, verify its commit (`git show --stat`), run the
  named tests yourself, then proceed. Don't batch-trust.

## ⚠️ Decision gate inside the plan (Task 5 Step 5)
If 80k static points can't reach "resolves as individual particles" at the closest approach
(d≈4) even at max sane `pointScale`, **STOP** — do NOT build more speculatively. Escalate to
the recycled-proximity-patch variant (spec §"Budget strategy"), and surface the call to Max
first. The static-buffer-first / escalate-only-if-needed ordering is deliberate (YAGNI).

## Infra state (verify live — may have changed between sessions)
- **Dev server `:5173`** — needed for the labs. **Only Max can start it** (`npm run dev`);
  Claude must NOT (`feedback_no-start-servers`). Pre-check via chrome-devtools `list_pages`,
  NOT `curl` (sandbox returns `000` false-negative on localhost — `feedback_sandbox-localhost-probe`).
  If down, ask Max to run `npm run dev` (specify exactly that, in the well-dipper terminal).
- **GPU Chrome `:9223`** — the lab/harness test surface. Use chrome-devtools (GPU), NOT
  Playwright (CPU — useless for shaders) — `memory/well-dipper-testing-reference.md`. Relaunch
  recipe if the window's gone: `memory/chrome-devtools-9223-launch.md`. Watch the silent
  scale trap: `memory/chrome-devtools-screenshot-scaling.md` (verify innerWidth/dpr/RT-scale).
- **chrome-devtools MCP tools are DEFERRED** — load via ToolSearch:
  `select:mcp__chrome-devtools__list_pages,mcp__chrome-devtools__navigate_page,mcp__chrome-devtools__take_screenshot,mcp__chrome-devtools__evaluate_script,mcp__chrome-devtools__list_console_messages`
- Harness URL: `http://localhost:5173/well-dipper/rings-lod-lab.html?fresh=1`
  Lab URL: `http://localhost:5173/well-dipper/planet-lod-lab.html?fresh=1`

## Commit discipline (shared tree — a parallel warp session has WIP in `src/`)
**NEVER `git add -A`.** Stage explicit paths only (untracked loose PNGs + `src/` warp WIP must
stay out). Two-commit pattern: (1) code paths → commit → grab sha; (2) doc paths (card §7 +
tracker, sha stamped) → commit. The plan's tasks already list exact `git add` paths per commit.
Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. The commit hook
prints harmless `grep: subpattern name expected` lines — not a failure. **Do NOT push** — Max
confirms pushes.

## Git state at handoff
- **HEAD `d08cde7`** = "docs(F51): v2 design spec + implementation plan". Working tree on
  campaign paths is clean; only loose untracked PNGs + `src/` warp WIP sit outside (leave them).
- New files this session: the spec + plan (committed). The plan CREATES `ring-particle-cloud.js`,
  `tests/ring-particle-cloud.test.js`, `rings-lod-lab.html` and MODIFIES `planet-lod-lab.html`
  (+ docs at verdict). None of those exist yet.

## Skills for the next session
- **`superpowers:subagent-driven-development`** — REQUIRED, the execution harness for the plan.
- **chrome-devtools** (load deferred tools above) for the visual gates. NOT Playwright.
- Do NOT use `dev-collab-scope` / `verify-workstream` — the campaign + this plan replace them
  for F51.
- `npx vitest run tests/ring-particle-cloud.test.js tests/planet-archetypes.test.js` is the unit
  gate (the second must stay UNCHANGED — F51 adds no FEATURES/PROVINCES entry).
