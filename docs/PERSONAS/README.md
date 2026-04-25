# Personas

Canonical agent persona definitions for the Claude Code Dev Collab OS roles.

## Files (active)

- **`pm.md`** — The Product Manager (subagent). Articulates feature context into workstream briefs (`docs/WORKSTREAMS/<name>.md`), scopes each unit of work, cites Bible + principles. Staff-designer voice. Invoked at workstream start or scope shift.
- **`tester.md`** — The Test Manager (subagent). Gate that blocks "done" claims without empirical evidence. Verifies each coherent change against PM's brief ACs (or Max's verbatim direction if no brief). Has full tool access including chrome-devtools — runs live verification autonomously. Peer-review-committee voice. Invoked after each coherent unit of implementation.
- **`game-dev.md`** — The Game-Dev Expert (step-into role, NOT subagent). Working-Claude reads this doc and uses it as a frame when working on game / visual-graphics projects. Auto-activates for canonical game projects + library / HTML / path / README signals. Domain grounding around game feel, frame budget, perceptual smoothness, cinematic continuity, short visual iteration cycle.

## Files (retired)

- **`director.md`** — The Director (subagent). **RETIRED 2026-04-25.** Symlink at `~/.claude/agents/director.md` removed. `Agent(subagent_type="director")` no longer resolves. File preserved as historical reference; see "Retirement notes" at top of director.md for redistribution of critical functions. Audit logs at `~/.claude/state/dev-collab/audits/` are historical artifacts.

## Mechanism distinction

Two role mechanisms are in play:

| Mechanism | Examples | When it fires | Cost |
|---|---|---|---|
| **Subagent** | PM, Tester | Working-Claude calls `Agent(subagent_type="...")` — independent context window, separate Claude instance. | Tokens for a fresh context; latency for inter-process round-trip; independent perspective is the value. |
| **Step-into role** | Game-Dev Expert | Working-Claude reads the persona doc and frames its reasoning. Same Claude. | No token / latency overhead. No independent perspective; trust working-Claude to apply the framing. |

Subagents earn their cost when independent perspective is the goal (verification gating, brief authorship). Step-into roles earn theirs when domain grounding is the goal and independent perspective adds nothing useful.

## How subagents activate in Claude Code

Claude Code discovers agents at `~/.claude/agents/<name>.md`. The canonical files in this directory are symlinked to that location:

```
~/.claude/agents/pm.md     -> /home/ax/projects/well-dipper/docs/PERSONAS/pm.md
~/.claude/agents/tester.md -> /home/ax/projects/well-dipper/docs/PERSONAS/tester.md
```

Restart Claude Code after editing either file so the updated persona is picked up for new subagent invocations.

## How step-into roles activate

Working-Claude reads the doc as part of context loading when activation signals fire (see `game-dev.md` §"When to step into this role"). No symlink, no subagent type, no `Agent()` invocation.

## Editing

Edit the files in this directory — **not** `~/.claude/agents/`. The symlinks ensure Claude Code sees your changes without a second write.

PM and Tester both carry a "no commit on subagent" rule for production code (working-Claude commits). PM and Director historically had a "commit doc edits same-turn" rule; PM keeps that for brief / feature-doc edits. Tester does not commit (its outputs are verdicts in filesystem-only audit logs and verifier scripts in gitignored `recordings/`).

## Safety net

A Stop hook at `~/.claude/hooks/check-doc-commits.sh` blocks session stop if any monitored doc path has uncommitted changes. Monitored paths:

- `docs/FEATURES/**`
- `docs/WORKSTREAMS/**`
- `docs/PLAN_*.md`
- `docs/GAME_BIBLE.md`
- `docs/FEATURE_AUDIT.md`

Catches the rare case where an agent forgets to commit its output. The primary defense is still the agent's commit-discipline rule; the hook is belt-and-suspenders.

## Recovery on a fresh machine

```bash
git clone <well-dipper-repo> ~/projects/well-dipper
mkdir -p ~/.claude/agents
ln -s ~/projects/well-dipper/docs/PERSONAS/pm.md     ~/.claude/agents/pm.md
ln -s ~/projects/well-dipper/docs/PERSONAS/tester.md ~/.claude/agents/tester.md
```

Restart Claude Code. Verify with `Agent(subagent_type="pm", ...)` and `Agent(subagent_type="tester", ...)`.

## Export to other projects

Two options:

1. **Share the same canonical.** Leave `~/.claude/agents/` symlinked to well-dipper's personas. PM + Tester apply identically to every project; each project provides its own feature/workstream docs per the four-tier structure (AUDIT → FEATURES → PLAN → WORKSTREAMS). Game-dev step-into role applies to projects matching its activation signals.
2. **Per-project fork.** Copy these files into the new project's `docs/PERSONAS/` and rewire the symlinks to that project. Personas can then diverge per project.

Option 1 is the default and the simpler pattern. Option 2 exists for cases where a project has fundamentally different collaboration needs (uncommon).

## History

- **2026-04-18:** Created. Director + PM personas defined. Both as subagents.
- **2026-04-25:** Director retired (interactive-session friction outweighed value). Tester subagent added (verification gate against PM's brief). Game-Dev step-into role added (domain grounding for game projects). PM unchanged.
