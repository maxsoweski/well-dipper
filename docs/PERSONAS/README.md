# Personas

Canonical agent persona definitions for the Claude Code Director + PM roles.

## Files

- **`director.md`** — The Director. Audits alignment with feature criteria, catches recursive-loop and big-picture-drift patterns, owns feature docs (`docs/FEATURES/<name>.md`) and the Game Bible. Kubrick-direct voice.
- **`pm.md`** — The Product Manager. Articulates feature context into workstream briefs (`docs/WORKSTREAMS/<name>.md`), scopes each unit of work, cites Bible + principles. Staff-designer voice.

## How they activate in Claude Code

Claude Code discovers agents at `~/.claude/agents/<name>.md`. The canonical files in this directory are symlinked to that location:

```
~/.claude/agents/director.md -> /home/ax/projects/well-dipper/docs/PERSONAS/director.md
~/.claude/agents/pm.md       -> /home/ax/projects/well-dipper/docs/PERSONAS/pm.md
```

Restart Claude Code after editing either file so the updated persona is picked up for new subagent invocations.

## Editing

Edit the files in this directory — **not** `~/.claude/agents/`. The symlinks ensure Claude Code sees your changes without a second write.

Both personas carry a "Commit discipline" rule: any doc edit (including edits to the persona itself) gets committed same-turn. Max does not press commit — the process is automatic from the agent's side.

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
ln -s ~/projects/well-dipper/docs/PERSONAS/director.md ~/.claude/agents/director.md
ln -s ~/projects/well-dipper/docs/PERSONAS/pm.md       ~/.claude/agents/pm.md
```

Restart Claude Code. Verify with `Agent(subagent_type="director", ...)`.

## Export to other projects

Two options:

1. **Share the same canonical.** Leave `~/.claude/agents/` symlinked to well-dipper's personas. The Director + PM apply identically to every project; each project provides its own feature/workstream docs per the four-tier structure (AUDIT → FEATURES → PLAN → WORKSTREAMS).
2. **Per-project fork.** Copy these files into the new project's `docs/PERSONAS/` and rewire the symlinks to that project. Personas can then diverge per project.

Option 1 is the default and the simpler pattern. Option 2 exists for cases where a project has fundamentally different collaboration needs (uncommon).

## History

Created 2026-04-18 after the same-day Director + PM interview session. Prior to this relocation the personas lived only at `~/.claude/agents/` — unversioned, on-disk only, fragile to machine loss. The relocation closes that gap while preserving Claude Code's agent-discovery path via symlink.
